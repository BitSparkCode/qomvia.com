import { prisma } from "@/lib/db";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { DIMENSIONS, RUBRIC_VERSION } from "@/lib/rubric/types";

export const revalidate = 3600;

/**
 * The site that scores agent-readiness should be the most agent-readable site
 * in its category, so the whole product surface is described here in plain text.
 */
export async function GET() {
  const top = await prisma.scan.findMany({
    where: { status: "COMPLETE", isPublic: true, score: { not: null }, brand: { optedOut: false } },
    distinct: ["brandId"],
    orderBy: [{ brandId: "asc" }, { createdAt: "desc" }],
    include: { brand: true },
    take: 300,
  });
  const ranked = top.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 50);

  const body = `# ${SITE_NAME}

> ${SITE_NAME} measures whether AI shopping agents can discover, read and check out on an online store, and publishes a transparent ${Object.values(
    DIMENSIONS,
  ).reduce((sum, dimension) => sum + dimension.max, 0)}-point score (rubric v${RUBRIC_VERSION}).

## What you can do here
- Score any storefront: POST ${absoluteUrl("/api/scan")} with {"domain": "example.com"}
- Read a published score: GET ${absoluteUrl("/api/score/<slug>")}
- Measurement rules: ${absoluteUrl("/methodology")}
- Aggregate market statistics: ${absoluteUrl("/report")}
- Crawler policy: ${absoluteUrl("/bot")}
- Remove a store from the index: ${absoluteUrl("/opt-out")}

## Scoring dimensions
${Object.entries(DIMENSIONS)
  .map(([id, dimension]) => `- ${dimension.label} (${dimension.max} points, id: ${id})`)
  .join("\n")}

## Highest scoring stores
${ranked.map((scan) => `- ${scan.brand.domain}: ${scan.score}/100 (${scan.grade}) — ${absoluteUrl(`/site/${scan.brand.slug}`)}`).join("\n") || "- none yet"}

## Commercial
- Monitoring (weekly readiness re-scan + product-level LLM visibility, one shop): CHF 29/month
- Agency (25 shops, daily refresh, all four models, white-label): CHF 149/month
- Pricing: ${absoluteUrl("/pricing")}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
