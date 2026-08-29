import type { Metadata } from "next";
import { PricingActions } from "@/components/pricing-actions";
import { absoluteUrl, AGENCY_PRICE_CHF, MONITOR_PRICE_CHF } from "@/lib/site";
import { COMPETITOR_PRICE_CHF, CREDIT_PACKS, VISIBILITY_PLANS } from "@/lib/visibility/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free agent-readiness score. CHF ${MONITOR_PRICE_CHF}/month to track your products across ChatGPT and Perplexity, CHF ${AGENCY_PRICE_CHF}/month for agencies.`,
  alternates: { canonical: absoluteUrl("/pricing") },
};

const TIERS = [
  {
    name: "Public score",
    price: "Free",
    note: "no signup",
    product: null,
    features: [
      "Agent-readiness score and grade",
      "Every signal as ✓ / ! / ✕",
      "Agent-by-agent compatibility",
      "Earned \u201cAI Commerce Ready\u201d seal",
    ],
  },
  {
    name: "Monitoring",
    price: `CHF ${MONITOR_PRICE_CHF}`,
    note: "per month, one shop",
    product: "monitor" as const,
    highlight: true,
    features: [
      `${VISIBILITY_PLANS.MONITOR.promptBudget} buying questions per run, ChatGPT + Perplexity`,
      "Per-product tracking, you choose which products",
      `${VISIBILITY_PLANS.MONITOR.includedCompetitors} tracked competitor: where it is recommended instead of you`,
      "Recommendations tied to what we measured",
      "Weekly re-scan, alert when a deploy breaks agent access",
      `${VISIBILITY_PLANS.MONITOR.monthlyCredits} credits per month included`,
    ],
  },
  {
    name: "Agency",
    price: `CHF ${AGENCY_PRICE_CHF}`,
    note: "per month, 25 shops",
    product: "agency" as const,
    features: [
      `${VISIBILITY_PLANS.AGENCY.promptBudget} questions per run, all four models`,
      `${VISIBILITY_PLANS.AGENCY.locales} market locales per shop`,
      "Daily refresh",
      "White-label reports and API access",
      `${VISIBILITY_PLANS.AGENCY.includedCompetitors} tracked competitors per shop`,
      `${VISIBILITY_PLANS.AGENCY.monthlyCredits} credits per month included`,
    ],
  },
];

const MATRIX: { label: string; free: string; monitor: string; agency: string }[] = [
  { label: "Public score, grade and earned seal", free: "✓", monitor: "✓", agency: "✓" },
  { label: "Fix report: what to change, and the file to paste", free: "—", monitor: "✓", agency: "✓" },
  { label: "Readiness re-scans", free: "—", monitor: "Weekly", agency: "Daily" },
  {
    label: "Buying questions per visibility run",
    free: "—",
    monitor: VISIBILITY_PLANS.MONITOR.promptBudget.toLocaleString("en-CH"),
    agency: VISIBILITY_PLANS.AGENCY.promptBudget.toLocaleString("en-CH"),
  },
  { label: "Models asked", free: "—", monitor: "2", agency: "4" },
  {
    label: "Market locales",
    free: "—",
    monitor: String(VISIBILITY_PLANS.MONITOR.locales),
    agency: String(VISIBILITY_PLANS.AGENCY.locales),
  },
  {
    label: "Tracked competitor domains included",
    free: "—",
    monitor: String(VISIBILITY_PLANS.MONITOR.includedCompetitors),
    agency: String(VISIBILITY_PLANS.AGENCY.includedCompetitors),
  },
  { label: "Shops per account", free: "—", monitor: "1", agency: "25" },
  { label: "White-label reports and API access", free: "—", monitor: "—", agency: "✓" },
];

export default function PricingPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3 border-b border-rule pb-6">
        <p className="eyebrow">Plans</p>
        <h1 className="font-serif text-4xl tracking-tight">Pricing</h1>
        <p className="max-w-2xl leading-relaxed text-muted">
          The score is free and always public. You pay for the fix list behind it and for tracking your products inside
          AI answers, week after week.
        </p>
      </header>

      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`flex flex-col pt-4 ${tier.highlight ? "border-t-2 border-foreground" : "border-t border-border"}`}
          >
            <p className="eyebrow">{tier.name}</p>
            <p className="mt-2 font-serif text-3xl">{tier.price}</p>
            <p className="text-xs text-muted">{tier.note}</p>
            <ul className="mt-4 flex-1 divide-y divide-border text-sm text-muted">
              {tier.features.map((feature) => (
                <li key={feature} className="py-2 leading-relaxed">
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <PricingActions product={tier.product} />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-xl">Side by side</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground text-left">
              <th className="eyebrow py-2 font-normal">What you get</th>
              <th className="eyebrow w-24 py-2 text-right font-normal">Free</th>
              <th className="eyebrow w-28 py-2 text-right font-normal">Monitoring</th>
              <th className="eyebrow w-24 py-2 text-right font-normal">Agency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MATRIX.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5 leading-relaxed">{row.label}</td>
                {([
                  ["free", row.free],
                  ["monitor", row.monitor],
                  ["agency", row.agency],
                ] as const).map(([plan, cell]) => (
                  <td key={plan} className="tabular py-2.5 text-right text-muted">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-xl">Credits</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          One credit asks one question to one model in one market. Your plan includes a monthly allowance; large
          catalogues top up in packs of {CREDIT_PACKS.map((pack) => pack.credits.toLocaleString("en-CH")).join(" or ")}{" "}
          ({CREDIT_PACKS.map((pack) => `CHF ${pack.priceChf}`).join(" / ")}). A run never starts if your balance cannot
          cover it, so a scan can never surprise you with a bill.
        </p>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-xl">Tracked competitors</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Name the shops you actually lose to and every run tells you where they are recommended and you are not. Extra
          slots beyond your plan cost CHF {COMPETITOR_PRICE_CHF} per domain and month.
        </p>
      </section>

      <p className="text-xs text-muted">Prices exclude VAT. Cancel any time; purchased credits do not expire.</p>
    </div>
  );
}
