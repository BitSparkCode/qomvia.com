import type { Metadata } from "next";
import { PricingActions } from "@/components/pricing-actions";
import { absoluteUrl, AGENCY_PRICE_CHF, DEEP_AUDIT_PRICE_CHF, MONITOR_PRICE_CHF } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free public agent-readiness score. CHF 99 deep audit, CHF 29/month monitoring, CHF 149/month agency plan, and done-for-you agent-commerce enablement.",
  alternates: { canonical: absoluteUrl("/pricing") },
};

const TIERS = [
  {
    name: "Public score",
    price: "Free",
    product: null,
    features: [
      "100-point score with all 21 signals",
      "Public, shareable result page",
      "Embeddable badge",
      "One re-scan per hour",
    ],
  },
  {
    name: "Deep audit",
    price: `CHF ${DEEP_AUDIT_PRICE_CHF}`,
    note: "one-off",
    product: "deep_audit" as const,
    highlight: true,
    features: [
      "Up to 500 URLs crawled",
      "Every product and category template checked",
      "Platform-specific fix instructions",
      "Comparison against three competitors",
      "PDF report for stakeholders",
    ],
  },
  {
    name: "Monitoring",
    price: `CHF ${MONITOR_PRICE_CHF}`,
    note: "per month, one domain",
    product: "monitor" as const,
    features: [
      "Weekly re-scan",
      "Email alert when a score changes",
      "Always-current badge",
      "Score history and regression diffs",
    ],
  },
  {
    name: "Agency",
    price: `CHF ${AGENCY_PRICE_CHF}`,
    note: "per month, 25 domains",
    product: "agency" as const,
    features: [
      "25 domains monitored",
      "Competitor tracking per client",
      "API access",
      "White-label reports",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="max-w-2xl text-muted">
          The score is free and always public. You pay when you want the full defect list, continuous monitoring, or
          someone to fix it for you.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`flex flex-col rounded-xl border p-5 ${
              tier.highlight ? "border-accent bg-accent/5" : "border-border bg-surface"
            }`}
          >
            <h2 className="font-semibold">{tier.name}</h2>
            <p className="mt-2 text-2xl font-semibold">{tier.price}</p>
            {tier.note ? <p className="text-xs text-muted">{tier.note}</p> : null}
            <ul className="mt-4 flex-1 space-y-2 text-sm text-muted">
              {tier.features.map((feature) => (
                <li key={feature}>· {feature}</li>
              ))}
            </ul>
            <div className="mt-5">
              <PricingActions product={tier.product} />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Done-for-you enablement</h2>
        <p className="max-w-3xl text-sm text-muted">
          If the audit says your store cannot be transacted against, we can make it agent-buyable: a hosted product feed,
          structured-data fixes, an <code className="text-foreground">llms.txt</code>, and an agentic-checkout endpoint
          settled through your existing Stripe account, so funds never touch us. Scoped per store from CHF 1,500. Email
          hello@qomvia.com with your score page.
        </p>
      </section>

      <p className="text-xs text-muted">
        Prices exclude VAT. Deep audits are delivered within one hour of payment; if a crawl cannot complete because the
        store blocks all automated access, we refund it and tell you exactly what blocked us.
      </p>
    </div>
  );
}
