import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { absoluteUrl, gradeColor } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Agent-readiness leaderboard",
  description:
    "Which online stores AI shopping agents can actually read and check out on, ranked by measured agent-readiness score.",
  alternates: { canonical: absoluteUrl("/leaderboard") },
};

export default async function LeaderboardPage() {
  const scans = await prisma.scan.findMany({
    where: { status: "COMPLETE", isPublic: true, score: { not: null } },
    distinct: ["brandId"],
    orderBy: [{ brandId: "asc" }, { createdAt: "desc" }],
    include: { brand: true },
    take: 1000,
  });

  const ranked = scans
    .filter((scan) => !scan.brand.optedOut)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const countries = [...new Set(ranked.map((scan) => scan.brand.country).filter(Boolean))] as string[];

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-rule pb-6">
        <p className="eyebrow">Ranked by measured score</p>
        <h1 className="font-serif text-4xl tracking-tight">Agent-readiness leaderboard</h1>
        <p className="max-w-2xl leading-relaxed text-muted">
          Who AI agents can actually read, buy from and recommend today.
        </p>
        {countries.length > 0 ? (
          <p className="text-sm text-muted">Markets covered: {countries.join(", ")}</p>
        ) : null}
      </header>

      {ranked.length === 0 ? (
        <p className="text-muted">
          No public scores yet.{" "}
          <Link href="/" className="link-underline">
            Scan the first store →
          </Link>
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground text-left">
              <th className="eyebrow w-10 py-2 font-normal">#</th>
              <th className="eyebrow py-2 font-normal">Store</th>
              <th className="eyebrow hidden py-2 font-normal sm:table-cell">Platform</th>
              <th className="eyebrow py-2 text-right font-normal">Score</th>
              <th className="eyebrow py-2 text-right font-normal">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranked.map((scan, index) => (
              <tr key={scan.id}>
                <td className="tabular py-2.5 text-xs text-muted">{String(index + 1).padStart(2, "0")}</td>
                <td className="py-2.5">
                  <Link href={`/site/${scan.brand.slug}`} className="link-underline">
                    {scan.brand.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted">{scan.brand.domain}</span>
                </td>
                <td className="hidden py-2.5 text-muted sm:table-cell">{scan.brand.platform ?? "—"}</td>
                <td className="tabular py-2.5 text-right" style={{ color: gradeColor(scan.score ?? 0) }}>
                  {scan.score}
                </td>
                <td className="tabular py-2.5 text-right text-muted">{scan.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
