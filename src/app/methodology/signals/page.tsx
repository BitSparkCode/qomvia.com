import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SIGNALS } from "@/lib/rubric/signals";
import { DIMENSIONS, RUBRIC_VERSION, type DimensionId } from "@/lib/rubric/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The full rubric",
  description: "Every measured signal, its weight and why it matters.",
  robots: { index: false, follow: false },
};

export default async function SignalsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-12">
      <header className="space-y-3 border-b border-rule pb-6">
        <p className="eyebrow">Rubric v{RUBRIC_VERSION} · 100 points</p>
        <h1 className="font-serif text-4xl tracking-tight">The full rubric</h1>
        <p className="max-w-2xl leading-relaxed text-muted">
          All {SIGNALS.length} signals behind a score, with the weight of each one.
        </p>
        <Link href="/dashboard" className="link-underline">
          Back to dashboard →
        </Link>
      </header>

      <section className="space-y-8">
        {(Object.keys(DIMENSIONS) as DimensionId[]).map((dimensionId) => (
          <div key={dimensionId} className="space-y-3">
            <h2 className="flex items-baseline justify-between border-b border-border pb-2 font-serif text-lg">
              {DIMENSIONS[dimensionId].label}
              <span className="tabular text-xs text-muted">{DIMENSIONS[dimensionId].max} pts</span>
            </h2>
            <ul className="divide-y divide-border">
              {SIGNALS.filter((signal) => signal.dimension === dimensionId).map((signal) => (
                <li key={signal.id} className="space-y-1 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">{signal.title}</span>
                    <span className="tabular text-xs text-muted">{signal.max} pts</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{signal.why}</p>
                  <p className="tabular text-[11px] text-muted">signal id: {signal.id}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
