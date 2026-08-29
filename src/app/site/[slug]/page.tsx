import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionBars, ScoreDial, StatusPill } from "@/components/score";
import { BadgeSnippet } from "@/components/badge-snippet";
import { DeepAuditButton } from "@/components/deep-audit-button";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { DIMENSIONS, type DimensionId, type DimensionScore } from "@/lib/rubric/types";
import { absoluteUrl, DEEP_AUDIT_PRICE_CHF, SITE_NAME } from "@/lib/site";

export const revalidate = 3600;

async function loadBrand(slug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.optedOut) return null;
  const scan = await prisma.scan.findFirst({
    where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
    orderBy: { createdAt: "desc" },
    include: { signals: true },
  });
  if (!scan) return null;
  const history = await prisma.scan.findMany({
    where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { score: true, grade: true, createdAt: true },
  });
  return { brand, scan, history };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadBrand(slug);
  if (!data) return { title: "Not scored yet" };
  const title = `Is ${data.brand.name} agent-ready? ${data.scan.score}/100 (grade ${data.scan.grade})`;
  return {
    title,
    description: `${data.brand.name} (${data.brand.domain}) scores ${data.scan.score}/100 for AI agent readiness: machine access, product data, agent-commerce protocols, checkout traversability.`,
    alternates: { canonical: absoluteUrl(`/site/${slug}`) },
    openGraph: { title, url: absoluteUrl(`/site/${slug}`) },
  };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadBrand(slug);
  if (!data) notFound();
  const { brand, scan, history } = data;
  const dimensions = (scan.dimensions as unknown as DimensionScore[]) ?? [];
  const failing = scan.signals.filter((signal) => signal.status !== "pass").length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Agent-readiness score for ${brand.domain}`,
    description: `Measured agent-readiness score (${scan.score}/100, grade ${scan.grade}) for ${brand.domain}, rubric v${scan.rubricVersion}.`,
    url: absoluteUrl(`/site/${slug}`),
    creator: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    dateModified: scan.finishedAt?.toISOString() ?? scan.createdAt.toISOString(),
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: absoluteUrl(`/api/score/${slug}`) },
    ],
    variableMeasured: dimensions.map((dimension) => ({
      "@type": "PropertyValue",
      name: dimension.label,
      value: dimension.points,
      maxValue: dimension.max,
    })),
  };

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="flex flex-col gap-8 sm:flex-row sm:items-center">
        <ScoreDial score={scan.score ?? 0} grade={scan.grade ?? "F"} />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Is {brand.name} agent-ready?</h1>
          <p className="text-muted">
            <a href={`https://${brand.domain}`} rel="nofollow noopener" className="underline decoration-border">
              {brand.domain}
            </a>
            {brand.platform ? ` · ${brand.platform}` : ""} · scanned{" "}
            {new Date(scan.createdAt).toISOString().slice(0, 10)} · rubric v{scan.rubricVersion} · {scan.urlsFetched}{" "}
            read-only requests
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <DeepAuditButton domain={brand.domain} />
            <Link href="/methodology" className="rounded-lg border border-border px-4 py-2">
              How this is measured
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Score by dimension</h2>
          <DimensionBars dimensions={dimensions} />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">Score history</h2>
          {history.length <= 1 ? (
            <p className="text-sm text-muted">First scan. Re-scan in a month to see whether anything moved.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((entry) => (
                <li key={entry.createdAt.toISOString()} className="flex justify-between">
                  <span className="text-muted">{entry.createdAt.toISOString().slice(0, 10)}</span>
                  <span className="font-mono">
                    {entry.score} ({entry.grade})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">What we measured</h2>
        {(Object.keys(DIMENSIONS) as DimensionId[]).map((dimensionId) => {
          const rows = scan.signals.filter((signal) => signal.dimension === dimensionId);
          if (rows.length === 0) return null;
          return (
            <div key={dimensionId} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-baseline justify-between bg-surface px-4 py-3">
                <h3 className="font-medium">{DIMENSIONS[dimensionId].label}</h3>
                <span className="font-mono text-xs text-muted">{DIMENSIONS[dimensionId].max} pts</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((row) => {
                  const definition = SIGNALS.find((signal) => signal.id === row.signalId);
                  return (
                    <li key={row.id} className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill status={row.status} />
                        <span className="font-medium">{definition?.title ?? row.signalId}</span>
                        <span className="ml-auto font-mono text-xs text-muted">
                          {row.points}/{row.maxPoints}
                        </span>
                      </div>
                      <p className="text-sm text-muted">{row.detail}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {failing > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">
            {failing} fixable {failing === 1 ? "issue" : "issues"} — fix list is in the paid report
          </h2>
          <p className="mt-2 text-sm text-muted">
            The measurements above are public. The remediation detail is not: which files to publish, the exact markup
            and headers to change, and the order that recovers the most points per hour of work. That ships in the
            report for CHF {DEEP_AUDIT_PRICE_CHF}, together with a deep crawl of up to 500 URLs.
          </p>
          <div className="mt-4">
            <DeepAuditButton domain={brand.domain} label={`Unlock the fix list — CHF ${DEEP_AUDIT_PRICE_CHF}`} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2">
        <BadgeSnippet slug={slug} score={scan.score ?? 0} />
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Want the full picture?</h2>
          <p className="mt-2 text-sm text-muted">
            The deep audit crawls up to 500 URLs, checks every product template, compares you against three competitors
            and returns the prioritised fix list — which files to add, which markup to change, in what order.
          </p>
          <p className="mt-3 text-sm">CHF {DEEP_AUDIT_PRICE_CHF} one-off, delivered within an hour.</p>
          <div className="mt-4">
            <DeepAuditButton domain={brand.domain} />
          </div>
        </div>
      </section>

      <p className="text-xs text-muted">
        Scores are computed from public HTTP responses only. We never submit forms, never attempt a purchase and never
        bypass a bot challenge. Disagree with a result?{" "}
        <Link href="/methodology#corrections" className="underline">
          Request a correction
        </Link>
        .
      </p>
    </div>
  );
}
