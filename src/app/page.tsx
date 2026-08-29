import Link from "next/link";
import { RotatingWord } from "@/components/rotating-word";
import { ScanForm } from "@/components/scan-form";
import { prisma } from "@/lib/db";
import { AGENT_CLASSES } from "@/lib/rubric/agents";
import { SIGNALS } from "@/lib/rubric/signals";
import { gradeColor, MONITOR_PRICE_CHF } from "@/lib/site";

export const revalidate = 300;

/** Mid-point of each grade band, so the distribution bar uses the same colour scale as a score. */
const GRADE_MIDPOINT = { A: 95, B: 82, C: 67, D: 50, F: 20 } as const;
const GRADES = Object.keys(GRADE_MIDPOINT) as (keyof typeof GRADE_MIDPOINT)[];

export default async function HomePage() {
  const scans = await prisma.scan.findMany({
    where: { status: "COMPLETE", isPublic: true, score: { not: null } },
    distinct: ["brandId"],
    orderBy: [{ brandId: "asc" }, { createdAt: "desc" }],
    include: { brand: true, signals: { select: { signalId: true, status: true } } },
    take: 500,
  });

  const ranked = scans
    .filter((scan) => !scan.brand.optedOut)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const total = ranked.length;
  const average = total === 0 ? 0 : Math.round(ranked.reduce((sum, scan) => sum + (scan.score ?? 0), 0) / total);
  const failing = ranked.filter((scan) => (scan.score ?? 0) < 40).length;
  const failShare = total === 0 ? 0 : Math.round((failing / total) * 100);

  const grades = GRADES.map((grade) => ({
    grade,
    count: ranked.filter((scan) => scan.grade === grade).length,
  }));

  const worstSignals = SIGNALS.map((signal) => {
    const rows = ranked.flatMap((scan) => scan.signals.filter((row) => row.signalId === signal.id));
    const measured = rows.filter((row) => row.status !== "unknown").length;
    const failed = rows.filter((row) => row.status === "fail").length;
    return {
      id: signal.id,
      title: signal.failTitle,
      consequence: signal.consequence,
      share: measured === 0 ? 0 : Math.round((failed / measured) * 100),
    };
  })
    .filter((entry) => entry.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);

  const best = ranked.slice(0, 8);
  const worst = [...ranked].reverse().slice(0, 8);

  return (
    <div className="space-y-24">
      <section className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
        <div className="space-y-6">
          <p className="eyebrow">Free score · no signup · 21 measured signals</p>
          <h1 className="font-serif text-[2.6rem] leading-[1.08] tracking-tight sm:text-[3.4rem]">
            When <RotatingWord words={["ChatGPT", "Claude", "Perplexity", "Gemini", "Grok", "Kimi"]} /> recommends
            a shop, is it <em className="italic">yours</em>?
          </h1>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-muted">
            Enter your domain. We measure whether AI assistants can read your catalogue and reach your checkout — and
            show you which shops they name instead of you.
          </p>
          <ScanForm />
        </div>

        {total > 0 ? (
          <aside className="self-start border-t-2 border-foreground pt-5">
            <p className="eyebrow">Measured so far</p>
            <dl className="mt-4 divide-y divide-border">
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-sm text-muted">Storefronts</dt>
                <dd className="tabular text-2xl">{total}</dd>
              </div>
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-sm text-muted">Average score</dt>
                <dd className="tabular text-2xl" style={{ color: gradeColor(average) }}>
                  {average}
                  <span className="text-sm text-muted">/100</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between py-3">
                <dt className="text-sm text-muted">Graded F</dt>
                <dd className="tabular text-2xl text-bad">{failShare}%</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              <p className="eyebrow">Grade distribution</p>
              <ul className="flex items-end gap-1" aria-hidden>
                {grades.map((entry) => (
                  <li
                    key={entry.grade}
                    className="flex-1 border-t border-border"
                    style={{
                      height: `${8 + (total === 0 ? 0 : (entry.count / total) * 56)}px`,
                      background: gradeColor(GRADE_MIDPOINT[entry.grade]),
                      opacity: 0.85,
                    }}
                  />
                ))}
              </ul>
              <ul className="flex gap-1 text-center">
                {grades.map((entry) => (
                  <li key={entry.grade} className="tabular flex-1 text-[0.625rem] text-muted">
                    {entry.grade} {entry.count}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/report" className="link-underline mt-4 inline-block text-sm">
              Read the index
            </Link>
          </aside>
        ) : null}
      </section>

      {worstSignals.length > 0 ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 className="text-2xl">What is actually broken out there</h2>
            <p className="text-xs text-muted">Share of measured shops failing each check</p>
          </div>
          <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
            {worstSignals.map((entry) => (
              <li key={entry.id} className="border-t-2 border-foreground pt-4">
                <p className="tabular font-serif text-4xl leading-none text-bad">{entry.share}%</p>
                <h3 className="mt-3 text-lg leading-snug">{entry.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{entry.consequence}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="border-b border-rule pb-2">
          <h2 className="text-2xl">What you get</h2>
        </div>
        <div className="grid gap-10 sm:grid-cols-3">
          {[
            {
              kicker: "Free",
              title: "Your readiness score",
              body: "Which of your product, price and checkout signals AI agents can actually use — plus a shareable badge.",
              href: "/methodology",
              cta: "See the rubric",
            },
            {
              kicker: `From CHF ${MONITOR_PRICE_CHF} / month`,
              title: "Product-level visibility",
              body: "We ask ChatGPT and Perplexity real buying questions about your products, per market, and count how often you are named and linked.",
              href: "/visibility",
              cta: "How tracking works",
            },
            {
              kicker: "Included",
              title: "Competitors and fixes",
              body: "Who wins the answers you lose, and the specific catalogue changes that would put you in them.",
              href: "/pricing",
              cta: "See plans",
            },
          ].map((card) => (
            <article key={card.title} className="flex flex-col border-t-2 border-foreground pt-4">
              <p className="eyebrow">{card.kicker}</p>
              <h3 className="mt-1 text-xl">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{card.body}</p>
              <Link href={card.href} className="link-underline mt-4 text-sm">
                {card.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
          <h2 className="text-2xl">Six kinds of agent, six ways to lose the sale</h2>
          <p className="text-xs text-muted">Scored separately for your shop</p>
        </div>
        <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_CLASSES.map((agent) => (
            <li key={agent.id} className="border-t border-border pt-3">
              <h3 className="text-base leading-snug">{agent.label}</h3>
              <p className="mt-1 text-xs text-muted">{agent.examples}</p>
            </li>
          ))}
        </ul>
      </section>

      {ranked.length > 1 ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 className="text-2xl">The index today</h2>
            <Link href="/leaderboard" className="link-underline text-sm">
              Full leaderboard
            </Link>
          </div>
          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {[
              { title: "Most agent-ready", rows: best },
              { title: "Closed to agents", rows: worst },
            ].map((column) => (
              <div key={column.title}>
                <p className="eyebrow border-b border-border pb-2">{column.title}</p>
                <ul className="divide-y divide-border text-sm">
                  {column.rows.map((scan, index) => (
                    <li key={scan.id} className="flex items-baseline gap-3 py-2.5">
                      <span className="tabular w-6 text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                      <Link href={`/site/${scan.brand.slug}`} className="link-underline flex-1 truncate">
                        {scan.brand.name}
                      </Link>
                      <span className="tabular text-xs text-muted">{scan.brand.domain}</span>
                      <span className="tabular w-8 text-right" style={{ color: gradeColor(scan.score ?? 0) }}>
                        {scan.score}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 border-t-2 border-foreground bg-raised p-6 sm:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-xl">Fix it once, then watch it stay fixed</h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Monitoring adds the fix list behind your score, re-scans weekly, and emails you the day a deploy closes your
            shop to agents again.
          </p>
          <Link href="/pricing" className="link-underline text-sm">
            Plans from CHF {MONITOR_PRICE_CHF}/month
          </Link>
        </div>
        <div className="space-y-3 sm:border-l sm:border-rule sm:pl-8">
          <h2 className="text-xl">Scored well? Show it.</h2>
          <p className="text-sm leading-relaxed text-muted">
            Every scored shop gets a hosted badge that reads the live score, so it can never show a number you no longer
            hold.
          </p>
          <Link href="/leaderboard" className="link-underline text-sm">
            See who is winning
          </Link>
        </div>
      </section>
    </div>
  );
}
