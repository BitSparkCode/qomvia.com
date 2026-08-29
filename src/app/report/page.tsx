import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { absoluteUrl, gradeColor } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The state of agent commerce",
  description:
    "How many online stores AI shopping agents can actually read and transact against, measured across every store in our index.",
  alternates: { canonical: absoluteUrl("/report") },
};

type SignalStat = { id: string; title: string; failShare: number; measured: number };

async function buildReport() {
  const latest = await prisma.scan.findMany({
    where: { status: "COMPLETE", isPublic: true, score: { not: null } },
    distinct: ["brandId"],
    orderBy: [{ brandId: "asc" }, { createdAt: "desc" }],
    include: { brand: true, signals: true },
    take: 2000,
  });
  const scans = latest.filter((scan) => !scan.brand.optedOut);

  const stats: SignalStat[] = SIGNALS.map((signal) => {
    const rows = scans.flatMap((scan) => scan.signals.filter((row) => row.signalId === signal.id));
    const measured = rows.filter((row) => row.status !== "unknown").length;
    const failed = rows.filter((row) => row.status === "fail").length;
    return {
      id: signal.id,
      title: signal.title,
      measured,
      failShare: measured === 0 ? 0 : Math.round((failed / measured) * 100),
    };
  }).sort((a, b) => b.failShare - a.failShare);

  const total = scans.length;
  const average = total === 0 ? 0 : Math.round(scans.reduce((sum, scan) => sum + (scan.score ?? 0), 0) / total);
  const failing = scans.filter((scan) => (scan.score ?? 0) < 40).length;
  const grades = ["A", "B", "C", "D", "F"].map((grade) => ({
    grade,
    count: scans.filter((scan) => scan.grade === grade).length,
  }));

  return { total, average, failing, grades, stats };
}

export default async function ReportPage() {
  const { total, average, failing, grades, stats } = await buildReport();

  if (total === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-4xl tracking-tight">The state of agent commerce</h1>
        <p className="text-muted">
          The index is still being built. Once stores have been scored, this page publishes the aggregate numbers.
        </p>
        <Link href="/" className="link-underline">
          Scan a store →
        </Link>
      </div>
    );
  }

  const headline = stats[0];

  return (
    <div className="space-y-12">
      <header className="space-y-3 border-b border-rule pb-6">
        <p className="eyebrow">The Qomvia index</p>
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">The state of agent commerce</h1>
        <p className="max-w-2xl leading-relaxed text-muted">
          AI assistants are already recommending shops. We measured {total} of them — most are barely readable.
        </p>
        <Link href="/" className="link-underline">
          See where your store lands →
        </Link>
      </header>

      <section className="grid gap-8 sm:grid-cols-3">
        {[
          { label: "Stores measured", value: `${total}` },
          { label: "Average score", value: `${average}/100`, color: gradeColor(average) },
          { label: "Effectively closed to agents (grade F)", value: `${Math.round((failing / total) * 100)}%` },
        ].map((card) => (
          <div key={card.label} className="border-t-2 border-foreground pt-4">
            <div className="tabular text-3xl" style={card.color ? { color: card.color } : undefined}>
              {card.value}
            </div>
            <div className="mt-1 text-sm leading-relaxed text-muted">{card.label}</div>
          </div>
        ))}
      </section>

      {headline ? (
        <section className="border-y border-rule bg-raised px-6 py-8">
          <p className="font-serif text-2xl leading-snug">
            <span className="tabular">{headline.failShare}%</span> of measured stores fail{" "}
            {headline.title.toLowerCase()}.
          </p>
          <p className="mt-2 text-sm text-muted">
            Based on {headline.measured} stores where the signal could be measured.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="border-b border-rule pb-2 text-2xl">Where stores fail</h2>
        <ul className="divide-y divide-border">
          {stats
            .filter((stat) => stat.measured > 0)
            .map((stat) => (
              <li key={stat.id} className="flex items-center gap-4 py-2.5 text-sm">
                <span className="flex-1">{stat.title}</span>
                <span className="hidden h-px flex-1 bg-border sm:block">
                  <span className="block h-px bg-bad" style={{ width: `${stat.failShare}%` }} />
                </span>
                <span className="tabular w-16 text-right text-muted">{stat.failShare}%</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-rule pb-2 text-2xl">Grade distribution</h2>
        <ul className="grid grid-cols-5 gap-4 text-sm">
          {grades.map((entry) => (
            <li key={entry.grade} className="border-t border-border pt-3">
              <span className="font-serif text-2xl">{entry.grade}</span>
              <span className="tabular mt-1 block text-xs text-muted">{entry.count} stores</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted">
        Journalists: the underlying per-store measurements are available as JSON at{" "}
        <code>/api/score/&lt;slug&gt;</code>. Email press@qomvia.com for the full dataset.
      </p>
    </div>
  );
}
