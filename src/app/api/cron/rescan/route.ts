import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitToIndexNow } from "@/lib/indexnow";
import { scanDomain } from "@/lib/scan-service";

export const maxDuration = 300;

const BATCH = 10;

/**
 * Weekly re-scan for monitored domains first, then the stalest public pages.
 * Score changes create alert rows, which is what the monitoring email sends.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monitored = await prisma.brand.findMany({
    where: { optedOut: false, subscription: { status: "active" } },
    take: BATCH,
    orderBy: { updatedAt: "asc" },
  });

  const remaining = BATCH - monitored.length;
  const stale =
    remaining > 0
      ? await prisma.brand.findMany({
          where: { optedOut: false, id: { notIn: monitored.map((brand) => brand.id) } },
          take: remaining,
          orderBy: { updatedAt: "asc" },
        })
      : [];

  const results: { domain: string; score?: number; error?: string }[] = [];
  for (const brand of [...monitored, ...stale]) {
    try {
      const { result } = await scanDomain(brand.domain);
      results.push({ domain: brand.domain, score: result.score });
    } catch (error) {
      results.push({ domain: brand.domain, error: (error as Error).message });
    }
  }

  await submitToIndexNow([...monitored, ...stale].map((brand) => `/site/${brand.slug}`));
  return NextResponse.json({ scanned: results.length, results });
}

/** Vercel Cron invokes cron paths with GET and the CRON_SECRET bearer header. */
export const GET = POST;
