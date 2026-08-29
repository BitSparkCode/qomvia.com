import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DimensionList, ScoreDial } from "@/components/score";
import { prisma } from "@/lib/db";
import type { DimensionScore } from "@/lib/rubric/types";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

function splitPair(pair: string): [string, string] | null {
  const parts = pair.split("-vs-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

async function loadPair(pair: string) {
  const slugs = splitPair(pair);
  if (!slugs) return null;
  const brands = await prisma.brand.findMany({ where: { slug: { in: slugs }, optedOut: false } });
  if (brands.length !== 2) return null;
  const ordered = slugs.map((slug) => brands.find((brand) => brand.slug === slug)!);
  const scans = await Promise.all(
    ordered.map((brand) =>
      prisma.scan.findFirst({
        where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
  if (scans.some((scan) => !scan)) return null;
  return ordered.map((brand, index) => ({ brand, scan: scans[index]! }));
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair } = await params;
  const data = await loadPair(pair);
  if (!data) return { title: "Comparison not available" };
  const [left, right] = data;
  const title = `${left.brand.name} vs ${right.brand.name}: which is more agent-ready?`;
  return {
    title,
    description: `${left.brand.name} scores ${left.scan.score}/100 and ${right.brand.name} scores ${right.scan.score}/100 for AI agent readiness.`,
    alternates: { canonical: absoluteUrl(`/compare/${pair}`) },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const data = await loadPair(pair);
  if (!data) notFound();
  const [left, right] = data;
  const winner = (left.scan.score ?? 0) >= (right.scan.score ?? 0) ? left : right;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl tracking-tight">
          {left.brand.name} vs {right.brand.name}
        </h1>
        <p className="text-muted">
          {winner.brand.name} is currently more agent-ready, at {winner.scan.score}/100.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {[left, right].map((entry) => (
          <div key={entry.brand.id} className="space-y-5 panel p-5">
            <div className="flex items-center gap-4">
              <ScoreDial score={entry.scan.score ?? 0} grade={entry.scan.grade ?? "F"} size={104} />
              <div>
                <Link href={`/site/${entry.brand.slug}`} className="font-semibold hover:text-accent">
                  {entry.brand.name}
                </Link>
                <p className="text-xs text-muted">{entry.brand.domain}</p>
              </div>
            </div>
            <DimensionList dimensions={(entry.scan.dimensions as unknown as DimensionScore[]) ?? []} />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">
        Both scores use rubric v1 and are computed from public HTTP responses only.
      </p>
    </div>
  );
}
