import Link from "next/link";
import { ScanForm } from "@/components/scan-form";
import { prisma } from "@/lib/db";
import { gradeColor, SITE_NAME } from "@/lib/site";
import { DIMENSIONS } from "@/lib/rubric/types";

export const revalidate = 300;

export default async function HomePage() {
  const scans = await prisma.scan.findMany({
    where: { status: "COMPLETE", isPublic: true, score: { not: null } },
    distinct: ["brandId"],
    orderBy: [{ brandId: "asc" }, { createdAt: "desc" }],
    include: { brand: true },
    take: 500,
  });

  const ranked = scans
    .filter((scan) => !scan.brand.optedOut)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const total = ranked.length;
  const average = total === 0 ? 0 : Math.round(ranked.reduce((sum, scan) => sum + (scan.score ?? 0), 0) / total);

  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <p className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          Rubric v1 · 21 measured signals · transparent methodology
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Can AI agents actually <span className="text-accent">buy</span> from your store?
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          ChatGPT, Copilot and Perplexity are starting to shop on behalf of your customers. {SITE_NAME} measures whether
          they can reach your catalogue, read your prices and get to checkout — and gives you the exact defects to fix.
        </p>
        <ScanForm />
        {total > 0 ? (
          <p className="text-sm text-muted">
            {total} storefronts scored so far · average score{" "}
            <span style={{ color: gradeColor(average) }} className="font-semibold">
              {average}/100
            </span>
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {Object.entries(DIMENSIONS).map(([id, dimension]) => (
          <div key={id} className="rounded-xl border border-border bg-surface p-4">
            <div className="font-mono text-xs text-muted">{dimension.max} pts</div>
            <div className="mt-1 font-medium">{dimension.label}</div>
          </div>
        ))}
      </section>

      {ranked.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Most agent-ready right now</h2>
            <Link href="/leaderboard" className="text-sm text-accent">
              Full leaderboard →
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {ranked.slice(0, 8).map((scan, index) => (
              <li key={scan.id} className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="w-5 font-mono text-xs text-muted">{index + 1}</span>
                  <Link href={`/site/${scan.brand.slug}`} className="hover:text-accent">
                    {scan.brand.name}
                  </Link>
                  <span className="text-xs text-muted">{scan.brand.domain}</span>
                </span>
                <span className="font-mono font-semibold" style={{ color: gradeColor(scan.score ?? 0) }}>
                  {scan.score}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-3">
        {[
          {
            title: "Free public score",
            body: "A shareable page with sub-scores, the exact failing signals and an embeddable badge.",
            href: "/methodology",
            cta: "See the rubric",
          },
          {
            title: "Deep audit — CHF 99",
            body: "Up to 500 URLs, platform-specific fixes, competitor comparison and a PDF for your stakeholders.",
            href: "/pricing",
            cta: "See what you get",
          },
          {
            title: "Monitoring — CHF 29/mo",
            body: "Weekly re-scan, alerts when a change breaks agent access, badge kept up to date.",
            href: "/pricing",
            cta: "Start monitoring",
          },
        ].map((card) => (
          <div key={card.title} className="flex flex-col rounded-xl border border-border bg-surface p-5">
            <h3 className="font-semibold">{card.title}</h3>
            <p className="mt-2 flex-1 text-sm text-muted">{card.body}</p>
            <Link href={card.href} className="mt-4 text-sm text-accent">
              {card.cta} →
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
