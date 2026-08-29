import type { PlanTier } from "@prisma/client";
import { PROVIDER_CONFIG, type ProviderId } from "@/lib/visibility/providers";

export type VisibilityPlan = {
  /** Phrases asked per run. */
  promptBudget: number;
  /** Providers the plan pays for, in priority order. */
  providers: ProviderId[];
  /** Minimum days between automatic runs. */
  refreshDays: number;
};

/**
 * Budgets exist so a CHF 29 subscription cannot spend CHF 29 of provider
 * tokens: prompts × providers × per-answer cost is the whole cost model.
 */
export const VISIBILITY_PLANS: Record<PlanTier, VisibilityPlan> = {
  MONITOR: { promptBudget: 40, providers: ["openai", "perplexity"], refreshDays: 7 },
  AGENCY: { promptBudget: 150, providers: ["openai", "perplexity", "anthropic", "gemini"], refreshDays: 1 },
};

/** One-off deep audit buys a single snapshot, no recurring refresh. */
export const AUDIT_PLAN: VisibilityPlan = {
  promptBudget: 60,
  providers: ["openai", "perplexity"],
  refreshDays: Number.POSITIVE_INFINITY,
};

export function estimatedRunCostCents(plan: VisibilityPlan, providers: ProviderId[] = plan.providers): number {
  const perPrompt = providers.reduce((total, provider) => total + PROVIDER_CONFIG[provider].costCentsPerAnswer, 0);
  return Math.ceil(plan.promptBudget * perPrompt);
}
