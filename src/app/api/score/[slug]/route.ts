import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SIGNALS } from "@/lib/rubric/signals";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || brand.optedOut) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scan = await prisma.scan.findFirst({
    where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
    orderBy: { createdAt: "desc" },
    include: { signals: true },
  });
  if (!scan) return NextResponse.json({ error: "Not scored yet" }, { status: 404 });

  return NextResponse.json(
    {
      domain: brand.domain,
      name: brand.name,
      platform: brand.platform,
      score: scan.score,
      grade: scan.grade,
      rubricVersion: scan.rubricVersion,
      scannedAt: scan.createdAt,
      urlsFetched: scan.urlsFetched,
      dimensions: scan.dimensions,
      signals: scan.signals.map((signal) => ({
        id: signal.signalId,
        title: SIGNALS.find((definition) => definition.id === signal.signalId)?.title ?? signal.signalId,
        dimension: signal.dimension,
        status: signal.status,
      })),
      page: absoluteUrl(`/site/${brand.slug}`),
      methodology: absoluteUrl("/methodology"),
    },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
