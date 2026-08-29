import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionList, ScoreDial, StatusIcon, verdictFromStatus } from "@/components/score";
import { AGENT_INTERFACES, agentVerdicts, buildSignalLookup } from "@/lib/rubric/agents";
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

  const signalTitles = new Map(SIGNALS.map((signal) => [signal.id, signal.title]));
  const lookup = buildSignalLookup(scan.signals, signalTitles);
  const verdicts = agentVerdicts(lookup);
  const interfaces = AGENT_INTERFACES.map((row) => ({
    ...row,
    verdict: verdictFromStatus(lookup.get(row.signalId)?.status ?? "unknown"),
  }));

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
          <h2 className="mb-4 font-semibold">Readiness by dimension</h2>
          <DimensionList dimensions={dimensions} />
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
              <div className="bg-surface px-4 py-3">
                <h3 className="font-medium">{DIMENSIONS[dimensionId].label}</h3>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((row) => {
                  const definition = SIGNALS.find((signal) => signal.id === row.signalId);
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <StatusIcon verdict={verdictFromStatus(row.status)} />
                      <span className="font-medium">{definition?.title ?? row.signalId}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Which AI agents can use {brand.name}?</h2>
          <p className="max-w-3xl text-sm text-muted">
            Not every agent needs the same things. A research agent only has to read the page; a shopping agent has to
            reach a payable checkout; an MCP client needs a tool endpoint to call. Below is what {brand.domain} supports
            per class of agent, measured from public HTTP responses.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {verdicts.map(({ agent, verdict, met, missing, degraded }) => (
            <article key={agent.id} className="space-y-3 rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start gap-3">
                <StatusIcon verdict={verdict} size={24} />
                <div>
                  <h3 className="font-medium">{agent.label}</h3>
                  <p className="text-xs text-muted">{agent.examples}</p>
                </div>
              </div>
              <p className="text-sm text-muted">{agent.description}</p>
              <p className="text-sm">
                {verdict === "ok"
                  ? agent.worksNote
                  : verdict === "unknown"
                    ? "This scan could not determine it — usually because the relevant page could not be fetched."
                    : agent.breaksNote}
              </p>
              {missing.length > 0 ? (
                <p className="text-xs text-bad">Blocked by: {missing.join(", ")}</p>
              ) : null}
              {degraded.length > 0 ? (
                <p className="text-xs text-warn">Partial: {degraded.join(", ")}</p>
              ) : null}
              {met.length > 0 ? <p className="text-xs text-accent">Working: {met.join(", ")}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Machine interfaces & AI visibility (SEO/GEO)</h2>
          <p className="max-w-3xl text-sm text-muted">
            Classic SEO decides whether people find {brand.name} in a search engine. GEO — generative engine
            optimisation — decides whether an LLM can read, quote and transact with it. These are the interfaces that
            decide the second one.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <ul className="divide-y divide-border">
            {interfaces.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                <StatusIcon verdict={row.verdict} />
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-sm text-muted">{row.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {failing > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">
            {failing} fixable {failing === 1 ? "issue" : "issues"} — fix list is in the paid report
          </h2>
          <p className="mt-2 text-sm text-muted">
            The measurements above are public. The remediation detail is not: which files to publish, the exact markup
            and headers to change, and the order that fixes the most impactful gaps first. That ships in the
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
