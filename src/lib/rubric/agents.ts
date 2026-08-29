import type { SignalStatus } from "@/lib/rubric/types";

export type AgentClassId = "answer" | "shopping" | "mcp" | "integrator" | "comparison" | "payments";

export type AgentClass = {
  id: AgentClassId;
  label: string;
  /** Who this actually is, in the buyer's language. */
  examples: string;
  description: string;
  /** Signals that must pass, or this class of agent cannot do its job. */
  requires: string[];
  /** Signals that make the difference between "works" and "works well". */
  helps: string[];
  worksNote: string;
  breaksNote: string;
};

export const AGENT_CLASSES: AgentClass[] = [
  {
    id: "answer",
    label: "Answer engines & research agents",
    examples: "ChatGPT Search, Perplexity, Gemini, Claude with web search, Copilot",
    description:
      "They fetch pages with a plain HTTP client, read the server-rendered HTML and cite what they can parse. They do not run your JavaScript and they obey robots.txt.",
    requires: ["robots_ai_crawlers", "bot_ua_response", "server_rendered"],
    helps: ["sitemap", "llms_txt", "jsonld_product", "robots_product_paths"],
    worksNote: "Your pages can be read and quoted as a source when someone asks about this category.",
    breaksNote:
      "The agent is either blocked or receives an empty shell, so your shop cannot appear in AI answers — competitors that render server-side take the slot.",
  },
  {
    id: "shopping",
    label: "Autonomous shopping agents",
    examples: "Agentic checkout in ChatGPT (ACP), Operator-style browsing agents, retail copilots",
    description:
      "They add to cart and complete a purchase on the customer's behalf. They need a cart URL that works without a session, a checkout that does not demand an account, and form fields they can identify.",
    requires: ["cart_reachable", "guest_checkout", "form_semantics"],
    helps: ["acp_signals", "jsonld_offer", "stable_identifiers"],
    worksNote: "An agent can traverse from product to a payable checkout without a human in the loop.",
    breaksNote:
      "The purchase path dead-ends — the agent cannot reach checkout, is forced into account creation, or cannot tell your form fields apart, so the order goes to a store that is traversable.",
  },
  {
    id: "mcp",
    label: "MCP tool-callers",
    examples: "Claude Desktop, Cursor, custom MCP hosts, enterprise assistants",
    description:
      "They call typed tools over the Model Context Protocol instead of scraping. Discovery happens through a published MCP server or a well-known endpoint.",
    requires: ["mcp_discovery"],
    helps: ["machine_contact", "product_feed"],
    worksNote: "Assistants can query your catalogue as a tool, with typed arguments instead of screen scraping.",
    breaksNote:
      "No MCP surface is published, so tool-calling assistants have nothing to connect to and fall back to whatever they can scrape.",
  },
  {
    id: "integrator",
    label: "Feed & API integrators",
    examples: "Marketplaces, affiliate networks, agent commerce platforms, ERP connectors",
    description:
      "They ingest your catalogue in bulk and re-sync it. They need a machine-readable feed and identifiers that stay stable between syncs.",
    requires: ["product_feed", "stable_identifiers"],
    helps: ["jsonld_product", "sitemap"],
    worksNote: "Your catalogue can be ingested and kept in sync without bespoke scraping work.",
    breaksNote:
      "Every integration needs a custom scraper, and without stable ids matching breaks on the next catalogue change — most integrators simply skip you.",
  },
  {
    id: "comparison",
    label: "Price-comparison & monitoring bots",
    examples: "Toppreise, Idealo, Google Shopping crawlers, deal and stock trackers",
    description:
      "High-frequency, price-focused fetchers. They need price and availability in structured markup, and pages light enough to poll often.",
    requires: ["jsonld_offer"],
    helps: ["ttfb", "page_weight", "stable_identifiers", "product_feed"],
    worksNote: "Price and availability are readable, so your offers appear in comparisons and stay current.",
    breaksNote:
      "Price and availability are only in rendered markup or images, so comparison engines list a stale price or drop you entirely.",
  },
  {
    id: "payments",
    label: "Agent payment protocols",
    examples: "AP2 mandates, x402 machine payments, agent-initiated card flows",
    description:
      "The settlement layer for agent purchases: signed mandates or machine-payable endpoints that let an agent pay without a human entering card details.",
    requires: ["x402_ap2"],
    helps: ["acp_signals", "guest_checkout"],
    worksNote: "An agent can settle a payment against a protocol you already expose.",
    breaksNote:
      "No agent payment protocol is exposed, so any purchase still needs a human at the card form — the step where agent conversions are lost.",
  },
];

export type AgentClassVerdict = {
  agent: AgentClass;
  verdict: "ok" | "warn" | "missing" | "unknown";
  /** Requirement titles, so the page can show what holds and what blocks. */
  met: string[];
  missing: string[];
  degraded: string[];
};

export type SignalLookup = Map<string, { status: SignalStatus; title: string }>;

export function buildSignalLookup(
  rows: { signalId: string; status: string }[],
  titles: Map<string, string>,
): SignalLookup {
  return new Map(
    rows.map((row) => [
      row.signalId,
      { status: row.status as SignalStatus, title: titles.get(row.signalId) ?? row.signalId },
    ]),
  );
}

/**
 * Rolls the per-signal measurements up into "can this class of agent actually
 * use the shop": a required signal failing is a hard block, a partial is a
 * degradation, and helper signals only ever downgrade ok to warn.
 */
export function agentVerdicts(lookup: SignalLookup): AgentClassVerdict[] {
  return AGENT_CLASSES.map((agent) => {
    const met: string[] = [];
    const missing: string[] = [];
    const degraded: string[] = [];
    let unknown = 0;

    for (const signalId of agent.requires) {
      const row = lookup.get(signalId);
      if (!row) {
        unknown += 1;
        continue;
      }
      if (row.status === "pass") met.push(row.title);
      else if (row.status === "partial") degraded.push(row.title);
      else if (row.status === "fail") missing.push(row.title);
      else unknown += 1;
    }

    for (const signalId of agent.helps) {
      const row = lookup.get(signalId);
      if (!row) continue;
      if (row.status === "pass") met.push(row.title);
      else if (row.status === "partial") degraded.push(row.title);
      else if (row.status === "fail") degraded.push(row.title);
    }

    const verdict =
      missing.length > 0
        ? "missing"
        : degraded.length > 0
          ? "warn"
          : unknown === agent.requires.length
            ? "unknown"
            : "ok";

    return { agent, verdict, met, missing, degraded };
  });
}

export type InterfaceRow = { id: string; label: string; signalId: string; description: string };

/** The concrete machine interfaces a merchant either exposes or does not. */
export const AGENT_INTERFACES: InterfaceRow[] = [
  {
    id: "mcp",
    label: "MCP server",
    signalId: "mcp_discovery",
    description: "Typed tool access over the Model Context Protocol, discoverable without documentation.",
  },
  {
    id: "acp",
    label: "Agentic checkout (ACP)",
    signalId: "acp_signals",
    description: "Agent Commerce Protocol endpoints so an agent can create and pay an order programmatically.",
  },
  {
    id: "payments",
    label: "Agent payments (AP2 / x402)",
    signalId: "x402_ap2",
    description: "Machine-payable endpoints or signed payment mandates for agent-initiated purchases.",
  },
  {
    id: "feed",
    label: "Product feed",
    signalId: "product_feed",
    description: "A bulk catalogue file (Google Merchant, RSS, JSON) an integrator can ingest and re-sync.",
  },
  {
    id: "jsonld",
    label: "Product structured data",
    signalId: "jsonld_product",
    description: "Schema.org Product markup in the server response, i.e. the catalogue in machine-readable form.",
  },
  {
    id: "offer",
    label: "Price & availability markup",
    signalId: "jsonld_offer",
    description: "Offer markup with price, currency and availability, which is what comparison agents read.",
  },
  {
    id: "identifiers",
    label: "Stable identifiers",
    signalId: "stable_identifiers",
    description: "GTIN/SKU/MPN values that let an agent match your product to the same product elsewhere.",
  },
  {
    id: "llms",
    label: "llms.txt",
    signalId: "llms_txt",
    description: "A machine-readable index of catalogue entry points, feeds and policies for LLM clients.",
  },
  {
    id: "robots",
    label: "AI crawler access",
    signalId: "robots_ai_crawlers",
    description: "Whether robots.txt lets GPTBot, ClaudeBot, PerplexityBot and friends fetch at all.",
  },
  {
    id: "ua",
    label: "Bot user-agent handling",
    signalId: "bot_ua_response",
    description: "Whether a non-browser client gets the same page as a browser, or a challenge instead.",
  },
  {
    id: "render",
    label: "Server-rendered content",
    signalId: "server_rendered",
    description: "Whether the content exists in the HTML response, since agents do not execute your JavaScript.",
  },
  {
    id: "guest",
    label: "Guest checkout",
    signalId: "guest_checkout",
    description: "Whether an agent can buy without creating an account or solving a login.",
  },
  {
    id: "contact",
    label: "Machine-readable contact",
    signalId: "machine_contact",
    description: "A documented address for agent operators to reach, e.g. in security.txt or llms.txt.",
  },
];
