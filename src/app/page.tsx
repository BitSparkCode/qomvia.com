import Link from "next/link";
import { ScanForm } from "@/components/scan-form";
import { prisma } from "@/lib/db";
import { gradeColor, MONITOR_PRICE_CHF } from "@/lib/site";

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
  const failing = ranked.filter((scan) => (scan.score ?? 0) < 40).length;
  const failShare = total === 0 ? 0 : Math.round((failing / total) * 100);

  return (
    <div className="space-y-20">
      <section className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
        <div className="space-y-6">
          <p className="eyebrow">Free score · no signup · 21 measured signals</p>
          <h1 className="font-serif text-[2.6rem] leading-[1.08] tracking-tight sm:text-[3.4rem]">
            When ChatGPT recommends a shop, is it <em className="italic">yours</em>?
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
            <Link href="/report" className="link-underline mt-4 inline-block text-sm">
              Read the index
            </Link>
          </aside>
        ) : null}
      </section>

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
              href: "/pricing",
              cta: "See plans",
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

      {ranked.length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <h2 className="text-2xl">Most agent-ready right now</h2>
            <Link href="/leaderboard" className="link-underline text-sm">
              Full leaderboard
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="eyebrow w-10 py-2 font-normal">#</th>
                <th className="eyebrow py-2 font-normal">Store</th>
                <th className="eyebrow hidden py-2 font-normal sm:table-cell">Domain</th>
                <th className="eyebrow py-2 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 10).map((scan, index) => (
                <tr key={scan.id} className="border-b border-border last:border-0">
                  <td className="tabular py-2.5 text-xs text-muted">{String(index + 1).padStart(2, "0")}</td>
                  <td className="py-2.5">
                    <Link href={`/site/${scan.brand.slug}`} className="link-underline">
                      {scan.brand.name}
                    </Link>
                  </td>
                  <td className="hidden py-2.5 text-muted sm:table-cell">{scan.brand.domain}</td>
                  <td className="tabular py-2.5 text-right" style={{ color: gradeColor(scan.score ?? 0) }}>
                    {scan.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
