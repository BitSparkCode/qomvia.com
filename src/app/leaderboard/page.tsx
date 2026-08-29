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
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Agent-readiness leaderboard</h1>
        <p className="max-w-2xl text-muted">
          Every score is computed from public HTTP responses with rubric v1. Anyone can re-scan a store, and every
          failing signal is shown with the measurement behind it.
        </p>
        {countries.length > 0 ? (
          <p className="text-sm text-muted">Markets covered: {countries.join(", ")}</p>
        ) : null}
      </header>

      {ranked.length === 0 ? (
        <p className="text-muted">
          No public scores yet.{" "}
          <Link href="/" className="text-accent">
            Scan the first store →
          </Link>
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2">#</th>
              <th className="py-2">Store</th>
              <th className="py-2">Platform</th>
              <th className="py-2 text-right">Score</th>
              <th className="py-2 text-right">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranked.map((scan, index) => (
              <tr key={scan.id}>
                <td className="py-2 font-mono text-xs text-muted">{index + 1}</td>
                <td className="py-2">
                  <Link href={`/site/${scan.brand.slug}`} className="hover:text-accent">
                    {scan.brand.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted">{scan.brand.domain}</span>
                </td>
                <td className="py-2 text-muted">{scan.brand.platform ?? "—"}</td>
                <td className="py-2 text-right font-mono" style={{ color: gradeColor(scan.score ?? 0) }}>
                  {scan.score}
                </td>
                <td className="py-2 text-right font-mono text-muted">{scan.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
