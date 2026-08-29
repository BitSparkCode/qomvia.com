import type { PlanTier } from "@prisma/client";
import { PROVIDER_CONFIG, type ProviderId } from "@/lib/visibility/providers";

/**
 * One credit buys one answer: one phrase, asked to one model, in one locale.
 * Priced at roughly ten times the measured provider cost, and every run records
 * its own `costCents` so the margin per shop stays auditable.
 */
export const CREDIT_PRICE_CHF = 0.05;

export const CREDIT_PACKS = [
  { credits: 1000, priceChf: 49 },
  { credits: 5000, priceChf: 199 },
] as const;

export type VisibilityPlan = {
  /** Phrases asked per run, before the credit balance caps it. */
  promptBudget: number;
  /** Providers the plan pays for, in priority order. */
  providers: ProviderId[];
  /** Minimum days between automatic runs. */
  refreshDays: number;
  /** How many market locales the phrase set is asked in. */
  locales: number;
  /** Credits granted every 30 days while the subscription is active. */
  monthlyCredits: number;
};

export const VISIBILITY_PLANS: Record<PlanTier, VisibilityPlan> = {
  MONITOR: {
    promptBudget: 300,
    providers: ["openai", "perplexity"],
    refreshDays: 7,
    locales: 1,
    monthlyCredits: 600,
  },
  AGENCY: {
    promptBudget: 1000,
    providers: ["openai", "perplexity", "anthropic", "gemini"],
    refreshDays: 1,
    locales: 3,
    monthlyCredits: 4000,
  },
};

/** Without a subscription a brand only gets a sample run, and never on a schedule. */
export const SAMPLE_PLAN: VisibilityPlan = {
  promptBudget: 12,
  providers: ["openai"],
  refreshDays: Number.POSITIVE_INFINITY,
  locales: 1,
  monthlyCredits: 0,
};

/** Credits a run of this size consumes: one per phrase per provider. */
export function creditsForRun(prompts: number, providers: ProviderId[]): number {
  return prompts * providers.length;
}

export function estimatedRunCostCents(plan: VisibilityPlan, providers: ProviderId[] = plan.providers): number {
  const perPrompt = providers.reduce((total, provider) => total + PROVIDER_CONFIG[provider].costCentsPerAnswer, 0);
  return Math.ceil(plan.promptBudget * perPrompt);
}
