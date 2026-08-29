import type { RunAggregate } from "@/lib/visibility/analyze";
import type { PromptIntent } from "@/lib/visibility/prompts";

export type Recommendation = {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  /** Phrases or competitors the recommendation was derived from. */
  evidence: string[];
};

export type IntentStats = Record<PromptIntent, { answers: number; mentions: number }>;

export type RecommendationInput = {
  brandName: string;
  aggregate: RunAggregate;
  byIntent: IntentStats;
  /** Phrases where the shop was absent, with the retailers that took the answer. */
  missed: { text: string; locale: string; winners: string[] }[];
  /** Tracked products that were never named in any answer. */
  silentProducts: string[];
  /** Readiness signals currently failing, which is what blocks model access. */
  failingSignals: { signalId: string; dimension: string }[];
};

function rate(stats: { answers: number; mentions: number }): number {
  return stats.answers === 0 ? 0 : stats.mentions / stats.answers;
}

const SIGNAL_ADVICE: Record<string, string> = {
  robots_ai_crawlers: "Stop blocking GPTBot, ClaudeBot, PerplexityBot and Google-Extended — blocked shops cannot be cited",
  robots_product_paths: "Allow crawlers on product and category paths, not just the homepage",
  bot_ua_response: "Serve agent user-agents the same HTML as browsers instead of a challenge page",
  server_rendered: "Render product data in the HTML — models do not run your JavaScript",
  jsonld_product: "Add complete Product JSON-LD so price, brand and description can be quoted verbatim",
  jsonld_offer: "Include Offer price, currency and availability in structured data",
  stable_identifiers: "Publish GTIN or MPN per product so models can match your item to the one being asked about",
  category_itemlist: "Mark up category pages as ItemList so your assortment is legible as a set",
  product_feed: "Expose a public product feed — the cheapest way for a model to learn your full assortment",
  llms_txt: "Publish /llms.txt as a curated map of your catalogue",
  acp_signals: "Support agentic checkout (ACP) so a buying agent can complete the purchase, not just cite you",
  mcp_discovery: "Ship an MCP endpoint so tool-calling agents can query your catalogue directly",
  sitemap: "Keep a complete, dated product sitemap so new items are discovered quickly",
  ai_policy: "State an AI usage policy — silence reads as a prohibition to some crawlers",
};

/**
 * Turns one run into the merchant-side changes that would plausibly move it.
 * Every item is derived from measured evidence — a missed phrase, a competitor
 * that took the answer, or a readiness signal that is currently failing.
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { aggregate, byIntent, missed, silentProducts, failingSignals } = input;

  for (const signal of failingSignals.slice(0, 5)) {
    const advice = SIGNAL_ADVICE[signal.signalId];
    if (!advice) continue;
    recommendations.push({
      title: advice.split("—")[0].trim(),
      detail: `${advice}.`,
      impact: "high",
      evidence: [`Readiness signal “${signal.signalId}” is failing (${signal.dimension}).`],
    });
  }

  const leaders = aggregate.shareOfVoice.slice(0, 3);
  if (leaders.length > 0 && aggregate.mentionRate < 0.5) {
    recommendations.push({
      title: `Answer the questions ${leaders[0].host} is answering`,
      detail: `${leaders.map((leader) => leader.host).join(", ")} appear in the answers you are missing. They win because they publish comparison and buying-guide content the models can quote. Add one guide per top category, with prices, specs and stock, on your own domain.`,
      impact: "high",
      evidence: leaders.map((leader) => `${leader.host} in ${Math.round(leader.share * 100)}% of answers`),
    });
  }

  if (rate(byIntent.category) < rate(byIntent.brand) && byIntent.category.answers > 0) {
    recommendations.push({
      title: "Win category phrases, not just your own name",
      detail:
        "Models name you when asked about your brand, but not when a shopper asks for the category. Category and collection pages need descriptive copy, faceted attributes and a visible assortment size, so the model can justify recommending you.",
      impact: "high",
      evidence: [
        `Brand phrases: ${Math.round(rate(byIntent.brand) * 100)}% mention rate`,
        `Category phrases: ${Math.round(rate(byIntent.category) * 100)}%`,
      ],
    });
  }

  if (aggregate.citationRate < 0.2 && aggregate.mentionRate > 0.2) {
    recommendations.push({
      title: "Get linked, not only named",
      detail:
        "You are mentioned but rarely linked, so the shopper leaves through someone else's URL. Canonical, crawlable product URLs with clean titles and no bot challenge are what turn a mention into a click.",
      impact: "medium",
      evidence: [`Citation rate ${Math.round(aggregate.citationRate * 100)}% vs mention rate ${Math.round(aggregate.mentionRate * 100)}%`],
    });
  }

  if (aggregate.avgRank !== null && aggregate.avgRank > 3) {
    recommendations.push({
      title: "Move up the recommendation list",
      detail:
        "When you do appear you are named after several competitors. Reviews, delivery terms and return policy in structured, machine-readable form are the attributes models use to order their shortlist.",
      impact: "medium",
      evidence: [`Average position ${aggregate.avgRank.toFixed(1)}`],
    });
  }

  if (silentProducts.length > 0) {
    recommendations.push({
      title: `${silentProducts.length} tracked products are never named`,
      detail:
        "These products are invisible in AI answers. Usually the cause is thin product copy, a missing GTIN/MPN or a title that nobody searches for. Rewrite the title to match how shoppers ask, and add the identifiers.",
      impact: "high",
      evidence: silentProducts.slice(0, 8),
    });
  }

  const missedLocales = new Map<string, number>();
  for (const phrase of missed) missedLocales.set(phrase.locale, (missedLocales.get(phrase.locale) ?? 0) + 1);
  const weakestLocale = [...missedLocales.entries()].sort((a, b) => b[1] - a[1])[0];
  if (weakestLocale && missedLocales.size > 1) {
    recommendations.push({
      title: `Weakest market: ${weakestLocale[0]}`,
      detail:
        "You are least visible in this locale. Localised category copy, local currency and delivery times, and a hreflang-correct URL per market are what make a model recommend you to a shopper there.",
      impact: "medium",
      evidence: missed
        .filter((phrase) => phrase.locale === weakestLocale[0])
        .slice(0, 5)
        .map((phrase) => phrase.text),
    });
  }

  return recommendations;
}
