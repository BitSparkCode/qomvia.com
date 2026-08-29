import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionList, ScoreDial, StatusIcon, verdictFromStatus } from "@/components/score";
import { AGENT_INTERFACES, agentVerdicts, buildSignalLookup } from "@/lib/rubric/agents";
import { BadgeSnippet } from "@/components/badge-snippet";
import { CheckoutButton } from "@/components/checkout-button";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { DIMENSIONS, type DimensionId, type DimensionScore } from "@/lib/rubric/types";
import { absoluteUrl, MONITOR_PRICE_CHF, SITE_NAME } from "@/lib/site";

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
  return { brand, scan };
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
  const { brand, scan } = data;
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
    <div className="space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="border-b border-rule pb-8">
        <p className="eyebrow">Agent-readiness report · rubric v{scan.rubricVersion}</p>
        <div className="mt-3 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Is {brand.name} agent-ready?</h1>
            <p className="text-sm text-muted">
              <a href={`https://${brand.domain}`} rel="nofollow noopener" className="link-underline">
                {brand.domain}
              </a>
              {brand.platform ? ` · ${brand.platform}` : ""} · last scanned{" "}
              <span className="tabular">{new Date(scan.createdAt).toISOString().slice(0, 10)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <CheckoutButton domain={brand.domain} />
              <Link href="/methodology" className="link-underline">
                How this is measured
              </Link>
            </div>
          </div>
          <ScoreDial score={scan.score ?? 0} grade={scan.grade ?? "F"} />
        </div>
      </section>

      <section>
        <h2 className="eyebrow border-b border-border pb-2">Readiness by dimension</h2>
        <div className="mt-3">
          <DimensionList dimensions={dimensions} />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-rule pb-2 text-2xl">What we measured</h2>
        {(Object.keys(DIMENSIONS) as DimensionId[]).map((dimensionId) => {
          const rows = scan.signals.filter((signal) => signal.dimension === dimensionId);
          if (rows.length === 0) return null;
          return (
            <div key={dimensionId}>
              <h3 className="eyebrow border-b border-border pb-2">{DIMENSIONS[dimensionId].label}</h3>
              <ul className="divide-y divide-border">
                {rows.map((row) => {
                  const definition = SIGNALS.find((signal) => signal.id === row.signalId);
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <StatusIcon verdict={verdictFromStatus(row.status)} />
                      <span>{definition?.title ?? row.signalId}</span>
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
          <h2 className="border-b border-rule pb-2 text-2xl">Which AI agents can use {brand.name}?</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted">
            Not every agent needs the same things. A research agent only has to read the page; a shopping agent has to
            reach a payable checkout; an MCP client needs a tool endpoint to call. Below is what {brand.domain} supports
            per class of agent, measured from public HTTP responses.
          </p>
        </div>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {verdicts.map(({ agent, verdict, met, missing, degraded }) => (
            <article key={agent.id} className="space-y-3 border-t border-border pt-4">
              <div className="flex items-start gap-3">
                <StatusIcon verdict={verdict} size={22} />
                <div>
                  <h3 className="font-serif text-lg leading-snug">{agent.label}</h3>
                  <p className="text-xs text-muted">{agent.examples}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted">{agent.description}</p>
              <p className="text-sm leading-relaxed">
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
          <h2 className="border-b border-rule pb-2 text-2xl">Machine interfaces & AI visibility (SEO/GEO)</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted">
            Classic SEO decides whether people find {brand.name} in a search engine. GEO — generative engine
            optimisation — decides whether an LLM can read, quote and transact with it. These are the interfaces that
            decide the second one.
          </p>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {interfaces.map((row) => (
            <li key={row.id} className="flex items-start gap-3 py-3">
              <StatusIcon verdict={row.verdict} />
              <div>
                <p className="text-sm">{row.label}</p>
                <p className="text-sm leading-relaxed text-muted">{row.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {failing > 0 ? (
        <section className="border-t-2 border-foreground bg-raised p-6">
          <h2 className="text-xl">
            {failing} {failing === 1 ? "gap" : "gaps"} between {brand.name} and the AI answers
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every measurement above is public. Monitoring adds what to do about it: the fix list for these gaps, plus
            weekly checks of how often ChatGPT and Perplexity name your products — and which shops they name instead.
          </p>
          <div className="mt-4">
            <CheckoutButton domain={brand.domain} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2">
        <BadgeSnippet slug={slug} score={scan.score ?? 0} />
        <div className="border-t border-border pt-4">
          <h2 className="text-xl">Are your products in the answers?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Import your catalogue and we ask the major models real buying questions about your products, per market,
            then report how often you are named, how often you are linked, and who outranks you.
          </p>
          <p className="mt-3 text-sm">From CHF {MONITOR_PRICE_CHF} per month, weekly.</p>
          <div className="mt-4">
            <CheckoutButton domain={brand.domain} />
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
