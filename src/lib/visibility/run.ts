import { prisma } from "@/lib/db";
import { aggregateRun, analyzeAnswer } from "@/lib/visibility/analyze";
import { askCached } from "@/lib/visibility/cache";
import { creditBalance, refundCredits, reserveCredits } from "@/lib/visibility/credits";
import { generatePrompts, localesForCountry, type PromptIntent } from "@/lib/visibility/prompts";
import { buildRecommendations, type IntentStats } from "@/lib/visibility/recommend";
import {
  SAMPLE_PLAN,
  VISIBILITY_PLANS,
  creditsForRun,
  type VisibilityPlan,
} from "@/lib/visibility/plans";
import { PROVIDER_CONFIG, configuredProviders, type ProviderId } from "@/lib/visibility/providers";

const CONCURRENCY = 4;
const ANSWER_STORE_CHARS = 4000;
const PROMPT_STORE_CAP = 6000;
/** How long a cached answer stays usable. Fresh enough weekly, cheap across shops. */
const CACHE_TTL_DAYS = 7;

export async function planForBrand(brandId: string): Promise<VisibilityPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { brandId },
    select: { tier: true, status: true },
  });
  if (subscription?.status === "active") return VISIBILITY_PLANS[subscription.tier];
  return SAMPLE_PLAN;
}

/**
 * Regenerates the phrase set from the tracked catalogue in every plan locale,
 * keeping prompt ids (and therefore history) stable.
 */
export async function syncPrompts(brandId: string, plan: VisibilityPlan): Promise<number> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true, domain: true, country: true },
  });
  if (!brand) throw new Error("Brand not found");

  const tracked = await prisma.product.count({ where: { brandId, tracked: true } });
  const products = await prisma.product.findMany({
    where: { brandId, ...(tracked > 0 ? { tracked: true } : {}) },
    select: { id: true, externalId: true, title: true, category: true, priceCents: true, currency: true },
    orderBy: { priceCents: "desc" },
    take: 5000,
  });

  const locales = localesForCountry(brand.country, plan.locales);
  const generated = generatePrompts(
    {
      brandName: brand.name,
      domain: brand.domain,
      locales,
      products: products.map((product) => ({
        externalId: product.externalId,
        title: product.title,
        category: product.category ?? undefined,
        priceCents: product.priceCents ?? undefined,
        currency: product.currency ?? undefined,
      })),
    },
    PROMPT_STORE_CAP,
  );

  const productIds = new Map(products.map((product) => [product.externalId, product.id]));

  for (const prompt of generated) {
    await prisma.visibilityPrompt.upsert({
      where: { brandId_locale_text: { brandId, locale: prompt.locale, text: prompt.text } },
      create: {
        brandId,
        text: prompt.text,
        intent: prompt.intent,
        locale: prompt.locale,
        productId: prompt.externalId ? (productIds.get(prompt.externalId) ?? null) : null,
      },
      update: { intent: prompt.intent, active: true },
    });
  }

  const keep = new Set(generated.map((prompt) => `${prompt.locale}|${prompt.text}`));
  const stale = await prisma.visibilityPrompt.findMany({
    where: { brandId, active: true },
    select: { id: true, text: true, locale: true },
  });
  const staleIds = stale.filter((prompt) => !keep.has(`${prompt.locale}|${prompt.text}`)).map((prompt) => prompt.id);
  if (staleIds.length > 0) {
    await prisma.visibilityPrompt.updateMany({ where: { id: { in: staleIds } }, data: { active: false } });
  }

  return generated.length;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

const EMPTY_INTENTS: IntentStats = {
  category: { answers: 0, mentions: 0 },
  product: { answers: 0, mentions: 0 },
  comparison: { answers: 0, mentions: 0 },
  brand: { answers: 0, mentions: 0 },
};

/** Aggregates competitors across runs, which is both the customer's rival view and our lead list. */
async function indexCompetitors(
  brandId: string,
  measured: { competitors: string[]; mentioned: boolean; rank: number | null }[],
): Promise<void> {
  const stats = new Map<string, { mentions: number; wins: number; bestRank: number | null }>();
  for (const result of measured) {
    for (const host of new Set(result.competitors)) {
      const entry = stats.get(host) ?? { mentions: 0, wins: 0, bestRank: null };
      entry.mentions += 1;
      if (!result.mentioned) entry.wins += 1;
      stats.set(host, entry);
    }
  }

  for (const [host, entry] of stats) {
    const existing = await prisma.competitor.findUnique({
      where: { brandId_name: { brandId, name: host } },
      select: { id: true },
    });
    if (existing) {
      await prisma.competitor.update({
        where: { id: existing.id },
        data: {
          mentions: { increment: entry.mentions },
          wins: { increment: entry.wins },
          lastSeenAt: new Date(),
        },
      });
    } else {
      await prisma.competitor.create({
        data: { brandId, name: host, domain: host, mentions: entry.mentions, wins: entry.wins },
      });
    }
  }
}

/** Per-phrase head-to-head for the domains a shop pays to watch. */
export async function competitorFaceOff(brandId: string, runId: string) {
  const watched = await prisma.competitor.findMany({
    where: { brandId, tracked: true },
    select: { name: true, domain: true },
  });
  if (watched.length === 0) return [];

  const results = await prisma.visibilityResult.findMany({
    where: { runId, error: null },
    select: { mentioned: true, rank: true, competitors: true, prompt: { select: { text: true, locale: true } } },
  });

  return watched.map((competitor) => {
    const host = (competitor.domain ?? competitor.name).replace(/^www\./, "").toLowerCase();
    const named = results.filter((result) => (result.competitors as string[]).includes(host));
    const beatsYou = named.filter((result) => !result.mentioned);
    return {
      host,
      answers: named.length,
      share: results.length > 0 ? named.length / results.length : 0,
      beatsYou: beatsYou.length,
      phrases: beatsYou.slice(0, 5).map((result) => ({
        text: result.prompt.text,
        locale: result.prompt.locale,
      })),
    };
  });
}

export type RunOptions = { trigger?: string; plan?: VisibilityPlan };

/**
 * Asks the plan's phrase budget to every provider the plan pays for, oldest
 * phrases first so successive runs cover the whole catalogue, then stores each
 * answer, the aggregate index, the competitor set and the recommendations.
 */
export async function runVisibility(brandId: string, options: RunOptions = {}) {
  const plan = options.plan ?? (await planForBrand(brandId));
  const available = new Set(configuredProviders());
  const providers = plan.providers.filter((provider) => available.has(provider));
  if (providers.length === 0) {
    throw new Error(
      `No LLM provider configured. Set ${plan.providers.map((provider) => PROVIDER_CONFIG[provider].envKey).join(" or ")}.`,
    );
  }

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true, domain: true },
  });
  if (!brand) throw new Error("Brand not found");

  await syncPrompts(brandId, plan);

  const watched = (
    await prisma.competitor.findMany({
      where: { brandId, tracked: true },
      select: { name: true, domain: true },
    })
  )
    .map((row) => ({ name: row.name, domain: row.domain ?? row.name }))
    .filter((row) => row.domain.includes("."));

  const balance = await creditBalance(brandId);
  const affordable = Math.floor(balance / providers.length);
  const budget = Math.min(plan.promptBudget, plan.monthlyCredits > 0 ? affordable : plan.promptBudget);
  if (budget < 1) {
    throw new Error("Out of credits — top up to run the next visibility scan.");
  }

  const prompts = await prisma.visibilityPrompt.findMany({
    where: { brandId, active: true },
    orderBy: [{ lastRunAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: budget,
    select: { id: true, text: true, intent: true, locale: true, productId: true },
  });
  if (prompts.length === 0) throw new Error("Import products first — there are no phrases to measure yet.");

  const locales = [...new Set(prompts.map((prompt) => prompt.locale))];
  const run = await prisma.visibilityRun.create({
    data: {
      brandId,
      trigger: options.trigger ?? "manual",
      providers,
      locales,
      status: "running",
      productsCovered: new Set(prompts.map((prompt) => prompt.productId).filter(Boolean)).size,
    },
  });

  const creditsUsed = creditsForRun(prompts.length, providers);
  const billable = plan.monthlyCredits > 0;
  if (billable) {
    try {
      await reserveCredits(brandId, creditsUsed, run.id);
    } catch (error) {
      await prisma.visibilityRun.update({
        where: { id: run.id },
        data: { status: "failed", error: (error as Error).message, finishedAt: new Date() },
      });
      throw error;
    }
  }

  type Job = (typeof prompts)[number] & { provider: ProviderId };
  const jobs: Job[] = prompts.flatMap((prompt) => providers.map((provider) => ({ ...prompt, provider })));

  try {
    const measured = await mapLimit(jobs, CONCURRENCY, async (job) => {
      const answer = await askCached(job.provider, job.text, job.locale, CACHE_TTL_DAYS);
      const analysis = answer.error
        ? { mentioned: false, cited: false, rank: null, competitors: [] }
        : analyzeAnswer(answer.text, answer.citations, { name: brand.name, domain: brand.domain }, watched);

      await prisma.visibilityResult.create({
        data: {
          runId: run.id,
          promptId: job.id,
          provider: job.provider,
          model: answer.model,
          mentioned: analysis.mentioned,
          cited: analysis.cited,
          rank: analysis.rank,
          competitors: analysis.competitors,
          citations: answer.citations.slice(0, 20),
          answer: answer.text.slice(0, ANSWER_STORE_CHARS),
          error: answer.error,
        },
      });

      return {
        ...analysis,
        failed: Boolean(answer.error),
        cached: answer.cached,
        provider: job.provider,
        intent: job.intent as PromptIntent,
        locale: job.locale,
        text: job.text,
        productId: job.productId,
      };
    });

    const usable = measured.filter((result) => !result.failed);
    if (usable.length === 0) throw new Error("Every provider call failed — check the API keys and quotas.");

    await prisma.visibilityPrompt.updateMany({
      where: { id: { in: prompts.map((prompt) => prompt.id) } },
      data: { lastRunAt: new Date() },
    });

    const aggregate = aggregateRun(usable);
    await indexCompetitors(brandId, usable);

    const byIntent: IntentStats = structuredClone(EMPTY_INTENTS);
    for (const result of usable) {
      const stats = byIntent[result.intent] ?? byIntent.category;
      stats.answers += 1;
      if (result.mentioned) stats.mentions += 1;
    }

    const mentionedProducts = new Set(
      usable.filter((result) => result.mentioned && result.productId).map((result) => result.productId),
    );
    const silentProductIds = [
      ...new Set(usable.map((result) => result.productId).filter((id): id is string => Boolean(id))),
    ].filter((id) => !mentionedProducts.has(id));
    const silentProducts = (
      await prisma.product.findMany({
        where: { id: { in: silentProductIds.slice(0, 40) } },
        select: { title: true },
      })
    ).map((product) => product.title);

    const latestScan = await prisma.scan.findFirst({
      where: { brandId, status: "COMPLETE" },
      orderBy: { createdAt: "desc" },
      select: { signals: { where: { status: { not: "ok" } }, select: { signalId: true, dimension: true } } },
    });

    const recommendations = buildRecommendations({
      brandName: brand.name,
      aggregate,
      byIntent,
      missed: usable
        .filter((result) => !result.mentioned)
        .slice(0, 200)
        .map((result) => ({ text: result.text, locale: result.locale, winners: result.competitors })),
      silentProducts,
      failingSignals: latestScan?.signals ?? [],
    });

    // Cached answers cost nothing, so only live calls are billed to tokens; credits
    // are charged per requested answer regardless, which is where the margin sits.
    const costCents = Math.ceil(
      measured.reduce(
        (total, result) => total + (result.cached ? 0 : PROVIDER_CONFIG[result.provider].costCentsPerAnswer),
        0,
      ),
    );
    return prisma.visibilityRun.update({
      where: { id: run.id },
      data: {
        status: "complete",
        promptsRun: prompts.length,
        score: aggregate.score,
        mentionRate: aggregate.mentionRate,
        citationRate: aggregate.citationRate,
        avgRank: aggregate.avgRank,
        shareOfVoice: aggregate.shareOfVoice,
        recommendations,
        creditsUsed,
        costCents,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    if (billable) await refundCredits(brandId, creditsUsed, run.id);
    await prisma.visibilityRun.update({
      where: { id: run.id },
      data: { status: "failed", error: (error as Error).message, finishedAt: new Date() },
    });
    throw error;
  }
}

export async function latestRun(brandId: string) {
  return prisma.visibilityRun.findFirst({
    where: { brandId, status: "complete" },
    orderBy: { createdAt: "desc" },
  });
}

export async function topCompetitors(brandId: string, limit = 10) {
  return prisma.competitor.findMany({
    where: { brandId },
    orderBy: [{ mentions: "desc" }, { wins: "desc" }],
    take: limit,
    select: { name: true, domain: true, mentions: true, wins: true, lastSeenAt: true },
  });
}

export async function runHistory(brandId: string, limit = 12) {
  return prisma.visibilityRun.findMany({
    where: { brandId, status: "complete" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, score: true, mentionRate: true, citationRate: true, avgRank: true },
  });
}
