import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportForm, LogoutButton, RescanButton, VisibilityRunButton } from "@/components/dashboard-actions";
import { StatusIcon, verdictFromStatus } from "@/components/score";
import { currentUser, entitlement } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { VISIBILITY_PLANS } from "@/lib/visibility/plans";
import { latestRun, runHistory } from "@/lib/visibility/run";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Re-scan your store, import your catalogue and track LLM visibility.",
  robots: { index: false, follow: false },
};

type ShareOfVoiceEntry = { host: string; answers: number; share: number };

function percent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const memberships = await prisma.brandMember.findMany({
    where: { userId: user.id },
    include: { brand: true },
    orderBy: { createdAt: "asc" },
  });

  const stores = await Promise.all(
    memberships.map(async (membership) => {
      const access = await entitlement(user.id, membership.brandId);
      const scan = await prisma.scan.findFirst({
        where: { brandId: membership.brandId, status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        include: { signals: true },
      });
      const products = await prisma.product.count({ where: { brandId: membership.brandId } });
      const run = await latestRun(membership.brandId);
      const history = await runHistory(membership.brandId, 8);
      return { brand: membership.brand, access, scan, products, run, history };
    }),
  );

  const titles = new Map(SIGNALS.map((signal) => [signal.id, signal.title]));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your stores</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <LogoutButton />
      </header>

      {stores.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-semibold">No store attached yet</h2>
          <p className="mt-2 text-sm text-muted">
            Stores are attached automatically to the email you paid with. If you used a different address, buy a plan
            with this one or write to hello@qomvia.com.
          </p>
          <Link href="/pricing" className="mt-4 inline-block text-sm text-accent">
            See plans →
          </Link>
        </div>
      ) : null}

      {stores.map(({ brand, access, scan, products, run, history }) => {
        const premium = access?.premium ?? false;
        const plan = access && access.tier !== "AUDIT" && access.tier !== "NONE" ? VISIBILITY_PLANS[access.tier] : null;
        const failing = scan?.signals.filter((signal) => signal.status !== "pass") ?? [];
        const shareOfVoice = ((run?.shareOfVoice as unknown as ShareOfVoiceEntry[]) ?? []).slice(0, 6);

        return (
          <section key={brand.id} className="space-y-6 rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{brand.name}</h2>
                <p className="text-sm text-muted">
                  {brand.domain} ·{" "}
                  {scan
                    ? `${scan.score}/100 (grade ${scan.grade}), scanned ${new Date(scan.createdAt)
                        .toISOString()
                        .slice(0, 10)}`
                    : "not scanned yet"}
                </p>
              </div>
              <div className="text-right text-sm text-muted">
                <p>{premium ? `Plan: ${access?.tier}` : "No active plan"}</p>
                <Link href={`/site/${brand.slug}`} className="text-accent">
                  Public score page →
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Agent readiness</h3>
                <RescanButton brandId={brand.id} disabled={!premium} />
                {failing.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {failing.slice(0, 8).map((signal) => (
                      <li key={signal.id} className="flex items-center gap-2">
                        <StatusIcon verdict={verdictFromStatus(signal.status)} size={18} />
                        <span>{titles.get(signal.signalId) ?? signal.signalId}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {premium && scan ? (
                  <Link href={`/site/${brand.slug}/report`} className="inline-block text-sm text-accent">
                    Open the fix report →
                  </Link>
                ) : null}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Catalogue</h3>
                <p className="text-sm text-muted">{products} products imported.</p>
                {premium ? (
                  <ImportForm brandId={brand.id} domain={brand.domain} />
                ) : (
                  <p className="text-sm text-muted">Product import is part of the paid plans.</p>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">LLM visibility</h3>
                {plan ? (
                  <p className="text-xs text-muted">
                    {plan.promptBudget} phrases · {plan.providers.join(", ")} · refresh every {plan.refreshDays}{" "}
                    day(s)
                  </p>
                ) : null}
              </div>

              {run ? (
                <>
                  <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-muted">Visibility index</dt>
                      <dd className="text-2xl font-semibold">{run.score ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Mentioned</dt>
                      <dd className="text-2xl font-semibold">{percent(run.mentionRate)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Cited</dt>
                      <dd className="text-2xl font-semibold">{percent(run.citationRate)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Avg. rank</dt>
                      <dd className="text-2xl font-semibold">
                        {run.avgRank == null ? "—" : run.avgRank.toFixed(1)}
                      </dd>
                    </div>
                  </dl>

                  {shareOfVoice.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold">Who the models name instead</h4>
                      <ul className="mt-2 space-y-1 text-sm text-muted">
                        {shareOfVoice.map((entry) => (
                          <li key={entry.host} className="flex justify-between gap-4">
                            <span>{entry.host}</span>
                            <span>{Math.round(entry.share * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {history.length > 1 ? (
                    <div>
                      <h4 className="text-sm font-semibold">History</h4>
                      <ul className="mt-2 space-y-1 text-sm text-muted">
                        {history.map((entry) => (
                          <li key={entry.id} className="flex justify-between gap-4">
                            <span>{new Date(entry.createdAt).toISOString().slice(0, 10)}</span>
                            <span>
                              index {entry.score ?? "—"} · mentioned {percent(entry.mentionRate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">
                  No visibility run yet. Import your catalogue, then run the first check — we turn your products into
                  real shopping questions and ask the models who they recommend.
                </p>
              )}

              {premium ? (
                <VisibilityRunButton brandId={brand.id} />
              ) : (
                <p className="text-sm text-muted">LLM visibility monitoring is part of the paid plans.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
