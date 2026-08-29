import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CompetitorTracker,
  ImportForm,
  LogoutButton,
  RescanButton,
  VisibilityRunButton,
  Watchlist,
} from "@/components/dashboard-actions";
import { CheckoutButton } from "@/components/checkout-button";
import { Disclosure, VerdictRow } from "@/components/report";
import { StatusIcon, verdictFromStatus } from "@/components/score";
import { currentUser, entitlement } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { creditBalance } from "@/lib/visibility/credits";
import { competitorAllowance, trackedCompetitors } from "@/lib/visibility/competitors";
import { COMPETITOR_PRICE_CHF, CREDIT_PACKS, VISIBILITY_PLANS } from "@/lib/visibility/plans";
import type { Recommendation } from "@/lib/visibility/recommend";
import { latestRun, runHistory, topCompetitors } from "@/lib/visibility/run";

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
      const products = await prisma.product.findMany({
        where: { brandId: membership.brandId },
        orderBy: [{ tracked: "desc" }, { priceCents: "desc" }],
        take: 300,
        select: { id: true, title: true, priceCents: true, currency: true, tracked: true },
      });
      const scanHistory = await prisma.scan.findMany({
        where: { brandId: membership.brandId, status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, score: true, grade: true, createdAt: true },
      });
      const run = await latestRun(membership.brandId);
      const history = await runHistory(membership.brandId, 8);
      const competitors = await topCompetitors(membership.brandId, 8);
      const watched = await trackedCompetitors(membership.brandId);
      const competitorSlots = await competitorAllowance(membership.brandId);
      const credits = await creditBalance(membership.brandId);
      return {
        brand: membership.brand,
        access,
        scan,
        scanHistory,
        products,
        run,
        history,
        competitors,
        watched,
        competitorSlots,
        credits,
      };
    }),
  );

  const titles = new Map(SIGNALS.map((signal) => [signal.id, signal.title]));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Your stores</h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/methodology/signals" className="link-underline text-sm">
            The full rubric →
          </Link>
          <LogoutButton />
        </div>
      </header>

      {stores.length === 0 ? (
        <div className="border border-border bg-surface p-6">
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

      {stores.map(
        ({
          brand,
          access,
          scan,
          scanHistory,
          products,
          run,
          history,
          competitors,
          watched,
          competitorSlots,
          credits,
        }) => {
        const premium = access?.premium ?? false;
        const plan = access && access.tier !== "AUDIT" && access.tier !== "NONE" ? VISIBILITY_PLANS[access.tier] : null;
        const failing = scan?.signals.filter((signal) => signal.status !== "pass") ?? [];
        const shareOfVoice = ((run?.shareOfVoice as unknown as ShareOfVoiceEntry[]) ?? []).slice(0, 6);
        const recommendations = ((run?.recommendations as unknown as Recommendation[]) ?? []).slice(0, 6);
        const creditsPerProduct = (plan?.providers.length ?? 1) * (plan?.locales ?? 1);

        return (
          <section key={brand.id} className="space-y-6 border border-border bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="border-b border-rule pb-2 text-2xl">{brand.name}</h2>
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
                <Link href={`/site/${brand.slug}`} className="link-underline">
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
                    {failing.map((signal) => (
                      <li key={signal.id} className="flex items-center gap-2">
                        <StatusIcon verdict={verdictFromStatus(signal.status)} size={18} />
                        <span>{titles.get(signal.signalId) ?? signal.signalId}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {scan ? (
                  <Disclosure summary="Every check, one by one" count={scan.signals.length}>
                    <ul className="divide-y divide-border">
                      {scan.signals.map((signal) => (
                        <VerdictRow
                          key={signal.id}
                          verdict={verdictFromStatus(signal.status)}
                          title={titles.get(signal.signalId) ?? signal.signalId}
                          note={signal.detail ?? undefined}
                        />
                      ))}
                    </ul>
                  </Disclosure>
                ) : null}
                {premium && scan ? (
                  <Link href={`/site/${brand.slug}/report`} className="inline-block text-sm text-accent">
                    Open the fix report →
                  </Link>
                ) : null}
                {premium && scanHistory.length > 1 ? (
                  <div className="pt-2">
                    <h4 className="text-xs uppercase tracking-wide text-muted">Score history</h4>
                    <ul className="mt-1 divide-y divide-border text-sm">
                      {scanHistory.map((entry) => (
                        <li key={entry.id} className="flex justify-between py-2 first:pt-0">
                          <span className="tabular text-muted">{entry.createdAt.toISOString().slice(0, 10)}</span>
                          <span className="tabular">
                            {entry.score} ({entry.grade})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Catalogue</h3>
                <p className="text-sm text-muted">
                  {products.length} products imported · {products.filter((product) => product.tracked).length} tracked ·{" "}
                  {credits} credits left
                </p>
                {premium ? (
                  <>
                    <ImportForm brandId={brand.id} domain={brand.domain} />
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {CREDIT_PACKS.map((pack) => (
                        <CheckoutButton
                          key={pack.credits}
                          domain={brand.domain}
                          product={pack.credits === CREDIT_PACKS[0].credits ? "pack_1000" : "pack_5000"}
                          label={`Top up ${pack.credits} credits — CHF ${pack.priceChf}`}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">Product import is part of the paid plans.</p>
                )}
              </div>
            </div>

            {premium && products.length > 0 ? (
              <div className="space-y-3 border-t border-border pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Which products we ask about
                </h3>
                <Watchlist brandId={brand.id} products={products} creditsPerProduct={creditsPerProduct} />
              </div>
            ) : null}

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

                  {recommendations.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold">What to change</h4>
                      <ol className="mt-2 space-y-3 text-sm">
                        {recommendations.map((recommendation) => (
                          <li key={recommendation.title} className="border-l-2 border-border pl-3">
                            <p className="font-medium">
                              {recommendation.title}{" "}
                              <span className="text-xs uppercase tracking-wide text-muted">
                                {recommendation.impact}
                              </span>
                            </p>
                            <p className="text-muted">{recommendation.detail}</p>
                            {recommendation.evidence.length > 0 ? (
                              <p className="mt-1 text-xs text-muted">{recommendation.evidence.join(" · ")}</p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {competitors.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold">Competitors discovered in your answers</h4>
                      <table className="mt-2 w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                            <th className="py-1 font-normal">Shop</th>
                            <th className="py-1 text-right font-normal">Named</th>
                            <th className="py-1 text-right font-normal">You absent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {competitors.map((competitor) => (
                            <tr key={competitor.name} className="border-b border-border last:border-0">
                              <td className="py-1.5">{competitor.domain ?? competitor.name}</td>
                              <td className="tabular py-1.5 text-right">{competitor.mentions}</td>
                              <td className="tabular py-1.5 text-right">{competitor.wins}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {shareOfVoice.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold">Share of voice</h4>
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

            {premium ? (
              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Tracked competitors</h3>
                  <CheckoutButton
                    domain={brand.domain}
                    product="competitor_slot"
                    label={`Add a slot — CHF ${COMPETITOR_PRICE_CHF}/mo`}
                  />
                </div>
                <CompetitorTracker brandId={brand.id} competitors={watched} allowance={competitorSlots} />
              </div>
            ) : null}
          </section>
        );
        },
      )}
    </div>
  );
}
