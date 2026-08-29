import { prisma } from "@/lib/db";
import { robotHeadInner } from "@/lib/logo";
import { grade } from "@/lib/rubric/types";
import { BADGE_HEIGHT, BADGE_WIDTH, gradeColor } from "@/lib/site";

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

const FONT = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif";

function svg(label: string, score: string, letter: string, color: string): string {
  const domain = label.length > 30 ? `${label.slice(0, 29)}…` : label;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(label)} agent-readiness ${escapeXml(score)} of 100">
  <rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="4" fill="#fbfaf7"/>
  <rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="4" fill="none" stroke="#cfc9bb"/>
  <g transform="translate(16 18) scale(1.25)">${robotHeadInner({}, { animated: true })}</g>
  <text x="70" y="31" font-family="${FONT}" font-size="10" fill="#6a675f" letter-spacing="1.1">QOMVIA · AGENT-READY</text>
  <text x="70" y="53" font-family="${FONT}" font-size="16" fill="#17181b">${escapeXml(domain)}</text>
  <line x1="${BADGE_WIDTH - 74}" y1="16" x2="${BADGE_WIDTH - 74}" y2="${BADGE_HEIGHT - 16}" stroke="#e0dcd2"/>
  <text x="${BADGE_WIDTH - 18}" y="45" text-anchor="end" font-family="${FONT}" font-size="30" font-weight="700" fill="${color}">${escapeXml(score)}</text>
  <text x="${BADGE_WIDTH - 18}" y="60" text-anchor="end" font-family="${FONT}" font-size="10" fill="#6a675f" letter-spacing="1.1">GRADE ${escapeXml(letter)}</text>
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
      ? svg(brand.domain, `${scan.score}`, grade(scan.score), gradeColor(scan.score))
      : svg("not scored yet", "—", "—", "#6a675f");

  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
