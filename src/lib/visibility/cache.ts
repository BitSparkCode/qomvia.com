import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { activeModel, askProvider, type ProviderAnswer, type ProviderId } from "@/lib/visibility/providers";

const MAX_ANSWER_CHARS = 8000;

function cacheKey(provider: ProviderId, model: string, locale: string, prompt: string): string {
  return createHash("sha256").update(`${provider}|${model}|${locale}|${prompt}`).digest("hex");
}

export type CachedAnswer = ProviderAnswer & { cached: boolean };

/**
 * Asks a provider unless the same phrase, model and locale was already answered
 * inside the TTL. Category and comparison phrases repeat across shops, so the
 * cache is what keeps the token bill sublinear in customers.
 */
export async function askCached(
  provider: ProviderId,
  prompt: string,
  locale: string,
  ttlDays: number,
): Promise<CachedAnswer> {
  const fresh = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const probe = await prisma.answerCache.findUnique({
    where: { key: cacheKey(provider, activeModel(provider), locale, prompt) },
  });
  if (probe && probe.createdAt >= fresh) {
    return {
      provider,
      model: probe.model,
      text: probe.answer,
      citations: probe.citations,
      cached: true,
    };
  }

  const answer = await askProvider(provider, prompt);
  if (!answer.error) {
    await prisma.answerCache.upsert({
      where: { key: cacheKey(provider, answer.model, locale, prompt) },
      create: {
        key: cacheKey(provider, answer.model, locale, prompt),
        provider,
        model: answer.model,
        locale,
        prompt,
        answer: answer.text.slice(0, MAX_ANSWER_CHARS),
        citations: answer.citations.slice(0, 20),
      },
      update: {
        answer: answer.text.slice(0, MAX_ANSWER_CHARS),
        citations: answer.citations.slice(0, 20),
        createdAt: new Date(),
      },
    });
  }
  return { ...answer, cached: false };
}
