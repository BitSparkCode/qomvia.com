import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusIcon, verdictFromStatus, verdictFromShare } from "@/components/score";
import { CountStrip, Disclosure, EffortTag, EvidenceTable, SeverityTag } from "@/components/report";
import { CheckoutButton } from "@/components/checkout-button";
import { paidAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { countFindings, findings, nextGradeTarget, type Severity } from "@/lib/rubric/findings";
import { SIGNALS } from "@/lib/rubric/signals";
import { snippetFor } from "@/lib/rubric/snippets";
import { type DimensionScore } from "@/lib/rubric/types";
import { MONITOR_PRICE_CHF } from "@/lib/site";

/** Paid deliverable: never cached publicly and never indexed. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fix report",
  robots: { index: false, follow: false },
};

const TIERS: { severity: Severity; title: string; blurb: string }[] = [
  {
    severity: "blocker",
    title: "Blockers",
    blurb: "Each of these stops a class of agent from using the shop at all. Nothing below matters until they are gone.",
  },
  {
    severity: "improvement",
    title: "Improvements",
    blurb: "Agents can work with the shop, but they lose information a competitor is handing them.",
  },
  { severity: "polish", title: "Polish", blurb: "Worth doing once the two tiers above are clear." },
];

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const { slug } = await params;
  const sessionParam = (await searchParams).session_id;
  const sessionId = Array.isArray(sessionParam) ? sessionParam[0] : sessionParam;

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) notFound();

  const access = await paidAccess(brand.id, sessionId);

  if (!access) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-serif text-4xl tracking-tight">Fix report for {brand.domain}</h1>
        <p className="text-muted">
          The public score page shows every measurement we took. This report adds what to do about it: the files to
          publish, the markup and headers to change, and the order to work through them in.
        </p>
        <p className="text-sm text-muted">
          Access comes with a plan for this shop. If you already pay and cannot see the report, sign in with the email
          you paid with, or write to hello@qomvia.com from an address on your domain.
        </p>
        <div className="flex flex-wrap gap-3">
          <CheckoutButton domain={brand.domain} label={`Start monitoring — CHF ${MONITOR_PRICE_CHF}/mo`} />
        </div>
        <p className="text-sm">
          <Link href={`/site/${slug}`} className="link-underline">
            ← Back to the public score
          </Link>
        </p>
      </div>
    );
  }

  const scan =
    (access.kind === "audit" && access.deepScanId
      ? await prisma.scan.findUnique({ where: { id: access.deepScanId }, include: { signals: true } })
      : null) ??
    (await prisma.scan.findFirst({
      where: { brandId: brand.id, status: "COMPLETE" },
      orderBy: { createdAt: "desc" },
      include: { signals: true },
    }));

  if (!scan) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-serif text-4xl tracking-tight">Fix report for {brand.domain}</h1>
        <p className="text-muted">
          Your deep scan is still running. Reload this page in a few minutes — the link stays valid.
        </p>
      </div>
    );
  }

  const previous = await prisma.scan.findFirst({
    where: { brandId: brand.id, status: "COMPLETE", createdAt: { lt: scan.createdAt } },
    orderBy: { createdAt: "desc" },
    include: { signals: { select: { signalId: true, status: true } } },
  });
  const before = new Map(previous?.signals.map((row) => [row.signalId, row.status]) ?? []);
  const fixedSince = previous
    ? previous.signals.filter(
        (row) =>
          row.status !== "pass" &&
          scan.signals.find((current) => current.signalId === row.signalId)?.status === "pass",
      ).length
    : 0;

  const dimensions = (scan.dimensions as unknown as DimensionScore[]) ?? [];
  const counts = countFindings(scan.signals);
  const list = findings(scan.signals);
  const target = nextGradeTarget(scan.score ?? 0, scan.signals);
  const signalTitles = new Map(SIGNALS.map((signal) => [signal.id, signal.title]));
  const scanDate = new Date(scan.createdAt).toISOString().slice(0, 10);

  return (
    <div className="space-y-10">
      <header className="space-y-4 border-b border-rule pb-6">
        <p className="eyebrow text-accent">Paid report · not indexed · keep this URL private</p>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-serif text-4xl tracking-tight">Fix report for {brand.domain}</h1>
          <p className="tabular text-sm text-muted">
            {scan.score}/100 · grade {scan.grade} · {scanDate}
          </p>
        </div>
        {target ? (
          <p className="max-w-2xl font-serif text-xl leading-snug">
            Fix the first {target.count} {target.count === 1 ? "item" : "items"} below and {brand.name} reaches grade{" "}
            {target.grade} (~{target.score}/100).
          </p>
        ) : (
          <p className="max-w-2xl font-serif text-xl leading-snug">
            {list.length === 0
              ? "Nothing is failing. Monitoring tells you the day a template change undoes that."
              : "The remaining items no longer change the grade, but they still cost you information agents use."}
          </p>
        )}
        <p className="text-xs text-muted">
          {scan.mode === "DEEP" ? "Deep" : "Standard"} scan of {scan.urlsFetched} URLs · rubric v{scan.rubricVersion}
          {previous
            ? ` · previous scan ${new Date(previous.createdAt).toISOString().slice(0, 10)}, ${fixedSince} fixed since`
            : ""}
        </p>
      </header>

      <CountStrip
        items={[
          { label: "Blockers", value: counts.blockers, tone: "bad" },
          { label: "Improvements & polish", value: counts.warnings, tone: "warn" },
          { label: "Checks passed", value: `${counts.passed}/${scan.signals.length}`, tone: "ok" },
        ]}
      />

      {TIERS.map((tier) => {
        const rows = list.filter((finding) => finding.severity === tier.severity);
        if (rows.length === 0) return null;
        return (
          <section key={tier.severity} className="space-y-4">
            <div className="space-y-1 border-b border-rule pb-2">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl">{tier.title}</h2>
                <p className="tabular text-xs text-muted">
                  {rows.length} {rows.length === 1 ? "item" : "items"}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">{tier.blurb}</p>
            </div>
            <ol className="space-y-6">
              {rows.map((finding) => {
                const snippet = finding.signal ? snippetFor(finding.signal.id, brand.domain) : null;
                const wasPassing = before.get(finding.row.signalId) === "pass";
                return (
                  <li key={finding.row.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusIcon verdict={verdictFromStatus(finding.status)} />
                        <h3 className="font-serif text-lg leading-snug">{finding.title}</h3>
                        {previous && wasPassing ? (
                          <span className="border border-bad px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-widest text-bad">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="max-w-2xl text-sm leading-relaxed">{finding.signal?.consequence}</p>
                      <p className="max-w-2xl text-sm leading-relaxed">
                        <span className="font-semibold">Do this:</span> {finding.signal?.fix}
                      </p>
                      {snippet ? (
                        <div className="border border-border">
                          <p className="border-b border-border bg-surface px-3 py-1.5 font-mono text-[0.6875rem] text-muted">
                            {snippet.filename}
                          </p>
                          <pre className="overflow-x-auto p-3 text-xs leading-relaxed">{snippet.body}</pre>
                        </div>
                      ) : null}
                      <Disclosure summary="What we measured">
                        <div className="space-y-2">
                          <p className="text-sm text-muted">{finding.row.detail}</p>
                          {finding.row.evidence ? <EvidenceTable evidence={finding.row.evidence} /> : null}
                          <p className="text-xs text-muted">Why it matters: {finding.signal?.why}</p>
                        </div>
                      </Disclosure>
                    </div>
                    <aside className="flex flex-row gap-3 sm:flex-col sm:items-end sm:gap-2 sm:border-l sm:border-border sm:pl-4">
                      <SeverityTag severity={finding.severity} />
                      <EffortTag effort={finding.effort} />
                      <span className="font-mono text-[0.625rem] uppercase tracking-widest text-muted">
                        {signalTitles.get(finding.row.signalId) ?? finding.row.signalId}
                      </span>
                    </aside>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <section className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="eyebrow border-b border-border pb-2">Score by dimension</h2>
          <ul className="divide-y divide-border">
            {dimensions.map((dimension) => (
              <li key={dimension.id} className="flex items-center gap-3 py-2 text-sm">
                <StatusIcon verdict={verdictFromShare(dimension.points, dimension.max)} size={18} />
                <span>{dimension.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="eyebrow border-b border-border pb-2">Passing checks</h2>
          <Disclosure summary="Everything that already works" count={counts.passed}>
            <ul className="divide-y divide-border">
              {scan.signals
                .filter((row) => row.status === "pass")
                .map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                    <StatusIcon verdict="ok" size={18} />
                    <span>{signalTitles.get(row.signalId) ?? row.signalId}</span>
                  </li>
                ))}
            </ul>
          </Disclosure>
          <p className="text-sm text-muted">
            Shipped a fix? Re-run the scan from{" "}
            <Link href="/dashboard" className="link-underline">
              your dashboard
            </Link>{" "}
            and this report updates, with anything new flagged against today&apos;s result.
          </p>
        </div>
      </section>

      <p className="text-xs text-muted">
        Keep this URL private — it is the access key to your report.{" "}
        <Link href={`/site/${slug}`} className="underline">
          Public score page
        </Link>
      </p>
    </div>
  );
}
