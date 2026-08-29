import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreDial, StatusIcon, verdictFromStatus, verdictFromShare } from "@/components/score";
import { CountStrip, Disclosure, VerdictRow } from "@/components/report";
import { AGENT_INTERFACES, agentVerdicts, buildSignalLookup } from "@/lib/rubric/agents";
import { BadgeSnippet } from "@/components/badge-snippet";
import { CheckoutButton } from "@/components/checkout-button";
import { prisma } from "@/lib/db";
import { countFindings, findings, verdictSentence } from "@/lib/rubric/findings";
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

  const signalTitles = new Map(SIGNALS.map((signal) => [signal.id, signal.title]));
  const lookup = buildSignalLookup(scan.signals, signalTitles);
  const verdicts = agentVerdicts(lookup);
  const counts = countFindings(scan.signals);
  const breaks = findings(scan.signals).slice(0, 5);
  const headline = verdictSentence(brand.name, verdicts);
  const interfaces = AGENT_INTERFACES.map((row) => ({
    ...row,
    verdict: verdictFromStatus(lookup.get(row.signalId)?.status ?? "unknown"),
  }));
  const exposed = interfaces.filter((row) => row.verdict === "ok");

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

      <section className="border-b border-rule pb-8">
        <p className="eyebrow">Agent-readiness report · rubric v{scan.rubricVersion}</p>
        <div className="mt-3 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="space-y-4">
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Is {brand.name} agent-ready?</h1>
            <p className="max-w-2xl font-serif text-xl leading-snug">{headline}</p>
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

      <CountStrip
        items={[
          { label: "Blocking agents", value: counts.blockers, tone: "bad" },
          { label: "Weak spots", value: counts.warnings, tone: "warn" },
          { label: "Checks passed", value: `${counts.passed}/${scan.signals.length}`, tone: "ok" },
        ]}
      />

      {breaks.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 className="text-2xl">What costs {brand.name} the most</h2>
            <p className="text-xs text-muted">Ordered by what agents lose first</p>
          </div>
          <ol className="divide-y divide-border">
            {breaks.map((finding) => (
              <li key={finding.row.id} className="grid gap-1 py-4 sm:grid-cols-[auto_1fr] sm:gap-4">
                <StatusIcon verdict={verdictFromStatus(finding.status)} size={22} />
                <div className="space-y-1">
                  <h3 className="font-serif text-lg leading-snug">{finding.title}</h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted">{finding.signal?.consequence}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            The fix for each of these — what to change, where, and the file to paste — is in the{" "}
            <Link href="/pricing" className="link-underline">
              monitored report
            </Link>
            .
          </p>
        </section>
      ) : (
        <section className="border-t-2 border-accent pt-4">
          <h2 className="text-2xl">Every check passes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {brand.name} is readable, comparable and traversable for the agent classes we test. Keep it that way:
            monitoring re-checks weekly and tells you the day something regresses.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
          <h2 className="text-2xl">Which agents can use it</h2>
          <p className="text-xs text-muted">
            {verdicts.filter((entry) => entry.verdict === "ok").length} of {verdicts.length} classes work
          </p>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {verdicts.map(({ agent, verdict, met, missing, degraded }) => (
            <li key={agent.id} className="py-3">
              <div className="grid gap-1 sm:grid-cols-[auto_1fr_minmax(0,22rem)] sm:items-baseline sm:gap-4">
                <StatusIcon verdict={verdict} />
                <div>
                  <p className="text-sm">{agent.label}</p>
                  <p className="text-xs text-muted">{agent.examples}</p>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {verdict === "ok"
                    ? agent.worksNote
                    : verdict === "unknown"
                      ? "Not determined in this scan — usually a page we could not fetch."
                      : agent.breaksNote}
                </p>
              </div>
              {missing.length > 0 || degraded.length > 0 ? (
                <div className="mt-1 sm:pl-9">
                  <Disclosure summary="What this agent needs">
                    <ul className="space-y-1 text-xs">
                      {missing.length > 0 ? <li className="text-bad">Blocked by: {missing.join(", ")}</li> : null}
                      {degraded.length > 0 ? <li className="text-warn">Partial: {degraded.join(", ")}</li> : null}
                      {met.length > 0 ? <li className="text-accent">Working: {met.join(", ")}</li> : null}
                      <li className="text-muted">{agent.description}</li>
                    </ul>
                  </Disclosure>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="space-y-3">
          <h2 className="border-b border-rule pb-2 text-2xl">Machine interfaces</h2>
          <p className="text-sm leading-relaxed text-muted">
            {exposed.length === 0
              ? `${brand.name} exposes none of the interfaces agents look for.`
              : `${brand.name} exposes ${exposed.length} of ${interfaces.length} interfaces agents look for: ${exposed
                  .map((row) => row.label)
                  .join(", ")}.`}
          </p>
          <Disclosure summary="All interfaces, one by one" count={interfaces.length}>
            <ul className="divide-y divide-border">
              {interfaces.map((row) => (
                <VerdictRow key={row.id} verdict={row.verdict} title={row.label} note={row.description} />
              ))}
            </ul>
          </Disclosure>
          <Disclosure summary="All checks by dimension" count={scan.signals.length}>
            <div className="space-y-5">
              {(Object.keys(DIMENSIONS) as DimensionId[]).map((dimensionId) => {
                const rows = scan.signals.filter((signal) => signal.dimension === dimensionId);
                if (rows.length === 0) return null;
                return (
                  <div key={dimensionId}>
                    <h3 className="eyebrow border-b border-border pb-2">{DIMENSIONS[dimensionId].label}</h3>
                    <ul className="divide-y divide-border">
                      {rows.map((row) => (
                        <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                          <StatusIcon verdict={verdictFromStatus(row.status)} size={18} />
                          <span>{signalTitles.get(row.signalId) ?? row.signalId}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Disclosure>
        </div>
        <aside className="space-y-4 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <h2 className="eyebrow">Score by dimension</h2>
          <ul className="divide-y divide-border">
            {dimensions.map((dimension) => (
              <li key={dimension.id} className="flex items-center gap-3 py-2 text-sm">
                <StatusIcon verdict={verdictFromShare(dimension.points, dimension.max)} size={18} />
                <span>{dimension.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted">
            Weightings and the signal-by-signal rubric are in{" "}
            <Link href="/methodology" className="link-underline">
              the methodology
            </Link>
            .
          </p>
        </aside>
      </section>

      <section className="grid gap-8 border-t-2 border-foreground bg-raised p-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xl">Get named in the answers, not just readable</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Monitoring adds the fix list for every gap above, then asks ChatGPT, Perplexity, Claude and Gemini real
            buying questions about your products every week — and names the shops recommended instead of you.
          </p>
          <p className="text-sm">From CHF {MONITOR_PRICE_CHF} per month.</p>
          <CheckoutButton domain={brand.domain} />
        </div>
        <BadgeSnippet
          slug={slug}
          domain={brand.domain}
          score={scan.score ?? 0}
          scannedOn={scan.createdAt.toISOString().slice(0, 10)}
        />
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
