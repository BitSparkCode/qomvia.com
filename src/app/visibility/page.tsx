import type { Metadata } from "next";
import Link from "next/link";
import { ProductVisibilityList } from "@/components/product-visibility";
import { ScanForm } from "@/components/scan-form";
import { absoluteUrl, AGENCY_PRICE_CHF, MONITOR_PRICE_CHF } from "@/lib/site";
import { VISIBILITY_PLANS } from "@/lib/visibility/plans";
import { SAMPLE_PRODUCTS } from "@/lib/visibility/sample";

export const metadata: Metadata = {
  title: "LLM product visibility",
  description:
    "Ask ChatGPT, Perplexity, Claude and Gemini real buying questions about your products, per market, and see how often you are named, linked and beaten.",
  alternates: { canonical: absoluteUrl("/visibility") },
};

const STEPS = [
  {
    step: "01",
    title: "Import the catalogue",
    body: "Shopify products.json, a Google Merchant feed, an XML or JSON feed, or a CSV paste. No app install, no store credentials.",
  },
  {
    step: "02",
    title: "Choose what you pay to measure",
    body: "Flag the products that matter. Only tracked products consume credits, so a 40,000-SKU catalogue costs what its top sellers cost.",
  },
  {
    step: "03",
    title: "We ask the questions a buyer asks",
    body: "Buying-intent phrases generated from your own catalogue — per product, per category, comparisons and brand-trust questions — in your market's language.",
  },
  {
    step: "04",
    title: "Every answer is measured",
    body: "Named or not, linked or not, at which position among the retailers listed, and which shops were recommended in your place.",
  },
];

const INDEX_PARTS = [
  { weight: "60%", label: "Mention rate", body: "Share of answers that name your shop at all." },
  { weight: "20%", label: "Citation rate", body: "Share of answers that link you, not just mention you." },
  { weight: "20%", label: "Position quality", body: "Where you sit among the retailers an answer lists." },
];

export default function VisibilityPage() {
  return (
    <div className="space-y-20">
      <header className="grid gap-10 border-b border-rule pb-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <div className="space-y-5">
          <p className="eyebrow">LLM product visibility</p>
          <h1 className="font-serif text-[2.4rem] leading-[1.1] tracking-tight sm:text-[3.1rem]">
            Rank tracking for the answers that replaced the search results
          </h1>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-muted">
            Your products, asked as real buying questions to the models buyers use, every week. You see how often you
            are named, how often you are linked, and which shop is recommended when you are not.
          </p>
          <ScanForm />
          <p className="text-sm text-muted">
            Start with the free readiness score. Tracking starts at CHF {MONITOR_PRICE_CHF}/month —{" "}
            <Link href="/pricing" className="link-underline">
              compare plans
            </Link>
            .
          </p>
        </div>
        <aside className="self-start border-t-2 border-foreground pt-5">
          <p className="eyebrow">Per run, on Monitoring</p>
          <dl className="mt-4 divide-y divide-border">
            {[
              { label: "Buying questions", value: VISIBILITY_PLANS.MONITOR.promptBudget.toLocaleString("en-CH") },
              { label: "Models asked", value: "ChatGPT + Perplexity" },
              { label: "Refresh", value: "Weekly" },
              { label: "Tracked competitor", value: String(VISIBILITY_PLANS.MONITOR.includedCompetitors) },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className="tabular text-right text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Agency runs {VISIBILITY_PLANS.AGENCY.promptBudget.toLocaleString("en-CH")} questions across four models and{" "}
            {VISIBILITY_PLANS.AGENCY.locales} markets, daily, from CHF {AGENCY_PRICE_CHF}/mo.
          </p>
        </aside>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
          <h2 className="text-2xl">How a run works</h2>
          <p className="text-xs text-muted">Four steps, then it repeats on a schedule</p>
        </div>
        <ol className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.step} className="border-t-2 border-foreground pt-4">
              <p className="tabular text-xs text-muted">{step.step}</p>
              <h3 className="mt-1 text-lg leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
          <h2 className="text-2xl">What you get back, per product</h2>
          <p className="text-xs text-muted">Sample output · shop anonymised</p>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          This is the deliverable, not a mock-up: every tracked product with the answer each model gave, the position
          it was listed at, the shop recommended instead, and the change that would win the answer back.
        </p>
        <ProductVisibilityList products={SAMPLE_PRODUCTS} />
        <p className="text-xs text-muted">
          Your own catalogue, your markets and your competitors —{" "}
          <Link href="/login" className="link-underline">
            attach your shop
          </Link>{" "}
          to run it.
        </p>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div className="space-y-5">
          <div className="border-b border-rule pb-2">
            <h2 className="text-2xl">One number you can defend</h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            The visibility index is a 0–100 figure built from three measured rates, not a sentiment read. Every run
            stores the exact phrase, the model, the market and the answer it was scored from.
          </p>
          <dl className="divide-y divide-border border-y border-border">
            {INDEX_PARTS.map((part) => (
              <div key={part.label} className="grid grid-cols-[4rem_1fr] gap-4 py-4">
                <dd className="tabular font-serif text-2xl leading-none">{part.weight}</dd>
                <div>
                  <dt className="text-sm">{part.label}</dt>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{part.body}</p>
                </div>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">Average rank is reported alongside it, run over run.</p>
        </div>

        <div className="space-y-5">
          <div className="border-b border-rule pb-2">
            <h2 className="text-2xl">Who is being recommended instead</h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Every retailer named in an answer is counted: how often it appears, how often it appears while you are
            absent, and the exact phrases where that happens. Name the shops you actually lose to and they are tracked
            by name as well as by link, so they count even in answers that never cite anyone.
          </p>
          <ul className="divide-y divide-border border-y border-border text-sm">
            {[
              "Share of voice across the answers in a run",
              "Phrases where a tracked competitor wins and you are absent",
              "Products that returned no mention at all",
              "Weakest market of the ones you cover",
            ].map((item) => (
              <li key={item} className="py-2.5 leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-muted">
            Each finding comes with the change that would fix it — derived from what we measured on your site, not from
            a checklist.
          </p>
        </div>
      </section>

      <section className="grid gap-8 border-t-2 border-foreground bg-raised p-6 sm:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-xl">Being readable comes first</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            A model cannot recommend a catalogue it cannot read. The free agent-readiness score tells you whether that
            is your problem before you pay to track anything.
          </p>
          <Link href="/" className="link-underline text-sm">
            Score your shop for free
          </Link>
        </div>
        <div className="space-y-3 sm:border-l sm:border-rule sm:pl-8">
          <h2 className="text-xl">What a run costs</h2>
          <p className="text-sm leading-relaxed text-muted">
            One credit asks one question to one model in one market. Your plan includes a monthly allowance and a run
            never starts if the balance cannot cover it.
          </p>
          <Link href="/pricing" className="link-underline text-sm">
            Credits and plans
          </Link>
        </div>
      </section>
    </div>
  );
}
