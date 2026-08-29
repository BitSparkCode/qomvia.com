import { embeddableTier, sealSvg } from "@/lib/badge";
import { prisma } from "@/lib/db";

export const revalidate = 3600;

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  "access-control-allow-origin": "*",
};

/**
 * Serves the seal markup to the `/badge.js` embed. There is no image URL to
 * hotlink, so a shop that has not earned a tier cannot display one.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  const scan = brand
    ? await prisma.scan.findFirst({
        where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const tier = brand && !brand.optedOut && scan ? embeddableTier(scan.score) : null;
  if (!brand || !scan || !tier) {
    return new Response(JSON.stringify({ earned: false }), { headers: HEADERS });
  }

  const verifiedOn = scan.createdAt.toISOString().slice(0, 10);

  return new Response(
    JSON.stringify({
      earned: true,
      tier: tier.id,
      title: tier.title,
      svg: sealSvg(tier, brand.domain, verifiedOn),
    }),
    { headers: HEADERS },
  );
}
