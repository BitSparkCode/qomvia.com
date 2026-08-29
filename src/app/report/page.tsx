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
        <h1 className="text-3xl font-semibold tracking-tight">The state of agent commerce</h1>
        <p className="text-muted">
          The index is still being built. Once stores have been scored, this page publishes the aggregate numbers.
        </p>
        <Link href="/" className="text-accent">
          Scan a store →
        </Link>
      </div>
    );
  }

  const headline = stats[0];

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">The state of agent commerce</h1>
        <p className="max-w-2xl text-muted">
          Measured across {total} storefronts with rubric v1. Every number here is reproducible: each store has a public
          page showing the individual measurements behind its score.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Stores measured", value: `${total}` },
          { label: "Average score", value: `${average}/100`, color: gradeColor(average) },
          { label: "Effectively closed to agents (grade F)", value: `${Math.round((failing / total) * 100)}%` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-2xl font-semibold" style={card.color ? { color: card.color } : undefined}>
              {card.value}
            </div>
            <div className="mt-1 text-sm text-muted">{card.label}</div>
          </div>
        ))}
      </section>

      {headline ? (
        <section className="rounded-xl border border-accent bg-accent/5 p-5">
          <p className="text-lg">
            <span className="font-semibold">{headline.failShare}%</span> of measured stores fail{" "}
            <span className="font-semibold">{headline.title.toLowerCase()}</span>.
          </p>
          <p className="mt-1 text-sm text-muted">
            Based on {headline.measured} stores where the signal could be measured.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Where stores fail</h2>
        <ul className="space-y-2">
          {stats
            .filter((stat) => stat.measured > 0)
            .map((stat) => (
              <li key={stat.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{stat.title}</span>
                  <span className="font-mono text-muted">{stat.failShare}% fail</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-bad" style={{ width: `${stat.failShare}%` }} />
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Grade distribution</h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          {grades.map((entry) => (
            <li key={entry.grade} className="rounded-lg border border-border bg-surface px-4 py-3">
              <span className="font-mono text-lg">{entry.grade}</span>
              <span className="ml-2 text-muted">{entry.count} stores</span>
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
