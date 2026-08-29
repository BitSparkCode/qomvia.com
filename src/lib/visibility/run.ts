import { prisma } from "@/lib/db";
import { aggregateRun, analyzeAnswer } from "@/lib/visibility/analyze";
import { generatePrompts } from "@/lib/visibility/prompts";
import { AUDIT_PLAN, VISIBILITY_PLANS, type VisibilityPlan } from "@/lib/visibility/plans";
import { PROVIDER_CONFIG, askProvider, configuredProviders, type ProviderId } from "@/lib/visibility/providers";

const CONCURRENCY = 4;
const ANSWER_STORE_CHARS = 4000;

export async function planForBrand(brandId: string): Promise<VisibilityPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { brandId },
    select: { tier: true, status: true },
  });
  if (subscription?.status === "active") return VISIBILITY_PLANS[subscription.tier];
  return AUDIT_PLAN;
}

/** Regenerates the phrase set from the current catalogue, keeping ids stable. */
export async function syncPrompts(brandId: string, budget: number): Promise<number> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true, domain: true, country: true },
  });
  if (!brand) throw new Error("Brand not found");

  const products = await prisma.product.findMany({
    where: { brandId },
    select: { externalId: true, title: true, category: true, priceCents: true },
    take: 2000,
  });

  const locale = brand.country === "DE" ? "de-DE" : brand.country === "AT" ? "de-AT" : "de-CH";
  const generated = generatePrompts(
    {
      brandName: brand.name,
      domain: brand.domain,
      locale,
      products: products.map((product) => ({
        externalId: product.externalId,
        title: product.title,
        category: product.category ?? undefined,
        priceCents: product.priceCents ?? undefined,
      })),
    },
    budget,
  );

  const productIds = new Map(
    (await prisma.product.findMany({ where: { brandId }, select: { id: true, externalId: true } })).map((product) => [
      product.externalId,
      product.id,
    ]),
  );

  for (const prompt of generated) {
    await prisma.visibilityPrompt.upsert({
      where: { brandId_text: { brandId, text: prompt.text } },
      create: {
        brandId,
        text: prompt.text,
        intent: prompt.intent,
        locale,
        productId: prompt.externalId ? (productIds.get(prompt.externalId) ?? null) : null,
      },
      update: { intent: prompt.intent, locale, active: true },
    });
  }

  const keep = new Set(generated.map((prompt) => prompt.text));
  await prisma.visibilityPrompt.updateMany({
    where: { brandId, text: { notIn: [...keep] } },
    data: { active: false },
  });

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

export type RunOptions = { trigger?: string; plan?: VisibilityPlan };

/**
 * Asks every active phrase to every provider the plan pays for, stores each
 * answer with its measurement, and writes the aggregate visibility index.
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

  await syncPrompts(brandId, plan.promptBudget);
  const prompts = await prisma.visibilityPrompt.findMany({
    where: { brandId, active: true },
    orderBy: { createdAt: "asc" },
    take: plan.promptBudget,
    select: { id: true, text: true },
  });
  if (prompts.length === 0) throw new Error("Import products first — there are no phrases to measure yet.");

  const run = await prisma.visibilityRun.create({
    data: { brandId, trigger: options.trigger ?? "manual", providers, status: "running" },
  });

  type Job = { promptId: string; text: string; provider: ProviderId };
  const jobs: Job[] = prompts.flatMap((prompt) =>
    providers.map((provider) => ({ promptId: prompt.id, text: prompt.text, provider })),
  );

  try {
    const measured = await mapLimit(jobs, CONCURRENCY, async (job) => {
      const answer = await askProvider(job.provider, job.text);
      const analysis = answer.error
        ? { mentioned: false, cited: false, rank: null, competitors: [] }
        : analyzeAnswer(answer.text, answer.citations, { name: brand.name, domain: brand.domain });

      await prisma.visibilityResult.create({
        data: {
          runId: run.id,
          promptId: job.promptId,
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

      return { ...analysis, failed: Boolean(answer.error), provider: job.provider };
    });

    const usable = measured.filter((result) => !result.failed);
    if (usable.length === 0) throw new Error("Every provider call failed — check the API keys and quotas.");

    const aggregate = aggregateRun(usable);
    const costCents = Math.ceil(
      measured.reduce((total, result) => total + PROVIDER_CONFIG[result.provider].costCentsPerAnswer, 0),
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
        costCents,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
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

export async function runHistory(brandId: string, limit = 12) {
  return prisma.visibilityRun.findMany({
    where: { brandId, status: "complete" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, score: true, mentionRate: true, citationRate: true, avgRank: true },
  });
}
