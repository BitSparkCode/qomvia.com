import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionList, StatusIcon, verdictFromStatus } from "@/components/score";
import { DeepAuditButton } from "@/components/deep-audit-button";
import { paidAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { type DimensionScore } from "@/lib/rubric/types";
import { DEEP_AUDIT_PRICE_CHF, MONITOR_PRICE_CHF } from "@/lib/site";

/** Paid deliverable: never cached publicly and never indexed. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fix report",
  robots: { index: false, follow: false },
};

/** Impact is expressed in words, not points, so the report reads as a to-do list. */
function impactLabel(missing: number): string {
  if (missing >= 8) return "critical";
  if (missing >= 4) return "high impact";
  if (missing >= 1.5) return "medium impact";
  return "polish";
}

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
        <h1 className="text-3xl font-semibold tracking-tight">Fix report for {brand.domain}</h1>
        <p className="text-muted">
          The public score page shows every measurement we took. This report adds what to do about it: the files to
          publish, the markup and headers to change, and the order to work through them in.
        </p>
        <p className="text-sm text-muted">
          Access is tied to the Stripe receipt link you get after payment — open the link from your confirmation page or
          email. If you already paid and lost the link, email hello@qomvia.com from an address on your domain.
        </p>
        <div className="flex flex-wrap gap-3">
          <DeepAuditButton domain={brand.domain} label={`Unlock the fix list — CHF ${DEEP_AUDIT_PRICE_CHF}`} />
          <DeepAuditButton
            domain={brand.domain}
            product="monitor"
            label={`Monitor monthly — CHF ${MONITOR_PRICE_CHF}/mo`}
          />
        </div>
        <p className="text-sm">
          <Link href={`/site/${slug}`} className="text-accent">
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
        <h1 className="text-3xl font-semibold tracking-tight">Fix report for {brand.domain}</h1>
        <p className="text-muted">
          Your deep scan is still running. Reload this page in a few minutes — the link stays valid.
        </p>
      </div>
    );
  }

  const dimensions = (scan.dimensions as unknown as DimensionScore[]) ?? [];
  const failing = scan.signals
    .filter((signal) => signal.status !== "pass")
    .map((signal) => ({ signal, definition: SIGNALS.find((entry) => entry.id === signal.signalId) }))
    .sort((a, b) => b.signal.maxPoints - b.signal.points - (a.signal.maxPoints - a.signal.points));

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-accent">Paid report · not indexed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Fix report for {brand.domain}</h1>
        <p className="text-muted">
          {scan.score}/100 (grade {scan.grade}) · {scan.mode === "DEEP" ? "deep" : "shallow"} scan of{" "}
          {scan.urlsFetched} URLs · rubric v{scan.rubricVersion} ·{" "}
          {new Date(scan.createdAt).toISOString().slice(0, 10)}
        </p>
        <p className="text-sm">
          {failing.length === 0
            ? "Nothing is failing right now."
            : `${failing.length} ${failing.length === 1 ? "item" : "items"} to fix, highest impact first.`}
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-semibold">Readiness by dimension</h2>
        <DimensionList dimensions={dimensions} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Fix list, highest value first</h2>
        {failing.length === 0 ? (
          <p className="text-muted">Nothing is failing. Keep monitoring so a template change does not undo it.</p>
        ) : (
          <ol className="space-y-4">
            {failing.map(({ signal, definition }, index) => (
              <li key={signal.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-muted">{index + 1}</span>
                  <StatusIcon verdict={verdictFromStatus(signal.status)} />
                  <span className="font-medium">{definition?.title ?? signal.signalId}</span>
                  <span className="ml-auto text-xs uppercase tracking-wide text-accent">
                    {impactLabel(signal.maxPoints - signal.points)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{signal.detail}</p>
                {definition ? (
                  <>
                    <p className="mt-2 text-sm">
                      <span className="text-accent">Fix:</span> {definition.fix}
                    </p>
                    <p className="mt-1 text-xs text-muted">Why it matters: {definition.why}</p>
                  </>
                ) : null}
                {signal.evidence ? (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-muted">
                    {JSON.stringify(signal.evidence, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
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
