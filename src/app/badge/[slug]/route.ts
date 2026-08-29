import { prisma } from "@/lib/db";
import { robotHeadInner } from "@/lib/logo";
import { gradeColor } from "@/lib/site";

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function svg(label: string, score: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" role="img" aria-label="${escapeXml(label)} ${escapeXml(score)}">
  <rect width="200" height="40" rx="6" fill="#0e1218"/>
  <rect x="0.5" y="0.5" width="199" height="39" rx="5.5" fill="none" stroke="#1e2632"/>
  <g transform="translate(9 8) scale(0.75)">${robotHeadInner()}</g>
  <text x="36" y="17" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" fill="#8d9bad" letter-spacing="0.8">QOMVIA · AGENT-READY</text>
  <text x="36" y="32" font-family="ui-sans-serif,system-ui,sans-serif" font-size="13" fill="#e8edf4">${escapeXml(label)}</text>
  <text x="188" y="27" text-anchor="end" font-family="ui-sans-serif,system-ui,sans-serif" font-size="20" font-weight="700" fill="${color}">${escapeXml(score)}</text>
</svg>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cleanSlug = slug.replace(/\.svg$/, "");
  const brand = await prisma.brand.findUnique({ where: { slug: cleanSlug } });
  const scan = brand
    ? await prisma.scan.findFirst({
        where: { brandId: brand.id, status: "COMPLETE", isPublic: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const body =
    brand && scan && !brand.optedOut && scan.score != null
      ? svg(brand.domain, `${scan.score}`, gradeColor(scan.score))
      : svg("not scored", "—", "#8d9bad");

  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
