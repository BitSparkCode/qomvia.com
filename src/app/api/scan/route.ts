import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDomain } from "@/lib/http";
import { submitToIndexNow } from "@/lib/indexnow";
import { latestScan, RESCAN_COOLDOWN_MS, scanDomain, upsertBrand } from "@/lib/scan-service";
import { absoluteUrl } from "@/lib/site";

export const maxDuration = 120;

const schema = z.object({ domain: z.string().min(3) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide { domain }" }, { status: 400 });

  let domain: string;
  try {
    domain = normalizeDomain(parsed.data.domain);
  } catch {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const brand = await upsertBrand(domain);
  if (brand.optedOut) return NextResponse.json({ error: "Domain has opted out" }, { status: 403 });

  const existing = await latestScan(brand.id);
  if (existing && Date.now() - existing.createdAt.getTime() < RESCAN_COOLDOWN_MS) {
    return NextResponse.json({
      domain,
      score: existing.score,
      grade: existing.grade,
      cached: true,
      page: absoluteUrl(`/site/${brand.slug}`),
    });
  }

  try {
    const { result } = await scanDomain(domain);
    await submitToIndexNow([`/site/${brand.slug}`]);
    return NextResponse.json({
      domain,
      score: result.score,
      grade: result.grade,
      dimensions: result.dimensions,
      cached: false,
      page: absoluteUrl(`/site/${brand.slug}`),
      api: absoluteUrl(`/api/score/${brand.slug}`),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
