export const PROVIDERS = ["openai", "perplexity", "anthropic", "gemini"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export type ProviderAnswer = {
  provider: ProviderId;
  model: string;
  text: string;
  citations: string[];
  error?: string;
};

type ProviderConfig = {
  label: string;
  envKey: string;
  defaultModel: string;
  /** Rough cost of one answer, for the per-plan budget maths. */
  costCentsPerAnswer: number;
};

export const PROVIDER_CONFIG: Record<ProviderId, ProviderConfig> = {
  openai: { label: "ChatGPT", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4.1-mini", costCentsPerAnswer: 0.3 },
  perplexity: { label: "Perplexity", envKey: "PERPLEXITY_API_KEY", defaultModel: "sonar", costCentsPerAnswer: 0.6 },
  anthropic: {
    label: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5-20250929",
    costCentsPerAnswer: 0.8,
  },
  gemini: {
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    costCentsPerAnswer: 0.2,
  },
};

const TIMEOUT_MS = 60_000;

function apiKey(provider: ProviderId): string | undefined {
  return process.env[PROVIDER_CONFIG[provider].envKey];
}

function model(provider: ProviderId): string {
  return process.env[`${PROVIDER_CONFIG[provider].envKey.replace("_API_KEY", "")}_MODEL`] ?? PROVIDER_CONFIG[provider].defaultModel;
}

export function configuredProviders(): ProviderId[] {
  return PROVIDERS.filter((provider) => Boolean(apiKey(provider)));
}

/** Collects every http(s) URL an answer references, so we can measure citations. */
export function extractUrls(value: unknown, sink = new Set<string>()): string[] {
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
      sink.add(match[0].replace(/[.,;]+$/, ""));
    }
  } else if (Array.isArray(value)) {
    for (const entry of value) extractUrls(entry, sink);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) extractUrls(entry, sink);
  }
  return [...sink];
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(detail);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT =
  "You are answering as a shopping assistant for a real consumer. Recommend concrete shops and products, " +
  "name the retailers you would buy from, and include links when you have them. Be specific, not generic.";

/**
 * Asks one provider one phrase, with web grounding enabled where the API offers
 * it — an ungrounded answer measures the model's memory, not today's visibility.
 */
export async function askProvider(provider: ProviderId, prompt: string): Promise<ProviderAnswer> {
  const key = apiKey(provider);
  const usedModel = model(provider);
  const base: ProviderAnswer = { provider, model: usedModel, text: "", citations: [] };
  if (!key) return { ...base, error: `${PROVIDER_CONFIG[provider].envKey} is not configured` };

  try {
    switch (provider) {
      case "openai": {
        const payload = (await postJson(
          "https://api.openai.com/v1/responses",
          { authorization: `Bearer ${key}` },
          {
            model: usedModel,
            input: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            tools: [{ type: "web_search" }],
          },
        )) as { output_text?: string; output?: unknown };
        const text = payload.output_text ?? collectText(payload.output);
        return { ...base, text, citations: extractUrls(payload.output ?? text) };
      }
      case "perplexity": {
        const payload = (await postJson(
          "https://api.perplexity.ai/chat/completions",
          { authorization: `Bearer ${key}` },
          {
            model: usedModel,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
          },
        )) as { choices?: { message?: { content?: string } }[]; citations?: string[]; search_results?: unknown };
        const text = payload.choices?.[0]?.message?.content ?? "";
        return {
          ...base,
          text,
          citations: [...new Set([...(payload.citations ?? []), ...extractUrls(payload.search_results ?? text)])],
        };
      }
      case "anthropic": {
        const payload = (await postJson(
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": key, "anthropic-version": "2023-06-01" },
          {
            model: usedModel,
            max_tokens: 1200,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
          },
        )) as { content?: { type?: string; text?: string }[] };
        const text = (payload.content ?? [])
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text)
          .join("\n");
        return { ...base, text, citations: extractUrls(payload.content ?? text) };
      }
      case "gemini": {
        const payload = (await postJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${usedModel}:generateContent`,
          { "x-goog-api-key": key },
          {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          },
        )) as {
          candidates?: {
            content?: { parts?: { text?: string }[] };
            groundingMetadata?: unknown;
          }[];
        };
        const candidate = payload.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");
        return { ...base, text, citations: extractUrls(candidate?.groundingMetadata ?? text) };
      }
    }
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
}

function collectText(output: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as { type?: string; text?: string; content?: unknown };
    if (record.type === "output_text" && typeof record.text === "string") parts.push(record.text);
    if (record.content) walk(record.content);
  };
  walk(output);
  return parts.join("\n");
}
