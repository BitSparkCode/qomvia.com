import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VISIBILITY_PLANS } from "@/lib/visibility/plans";
import { runVisibility } from "@/lib/visibility/run";

export const maxDuration = 300;

/** Bounded per invocation so provider spend stays predictable. */
const BATCH = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refreshes LLM visibility for paying stores whose last run is older than their
 * plan's cadence. Stores without an imported catalogue are skipped: there would
 * be no phrases to ask, and every provider call costs money.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscriptions = await prisma.subscription.findMany({
    where: { status: "active" },
    select: { brandId: true, tier: true },
  });

  const due: { brandId: string }[] = [];
  for (const subscription of subscriptions) {
    if (due.length >= BATCH) break;
    const products = await prisma.product.count({ where: { brandId: subscription.brandId } });
    if (products === 0) continue;

    const last = await prisma.visibilityRun.findFirst({
      where: { brandId: subscription.brandId, status: { in: ["complete", "running"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const cadenceMs = VISIBILITY_PLANS[subscription.tier].refreshDays * DAY_MS;
    if (last && Date.now() - last.createdAt.getTime() < cadenceMs) continue;
    due.push({ brandId: subscription.brandId });
  }

  const results: { brandId: string; score?: number | null; error?: string }[] = [];
  for (const item of due) {
    try {
      const run = await runVisibility(item.brandId, { trigger: "cron" });
      results.push({ brandId: item.brandId, score: run.score });
    } catch (error) {
      results.push({ brandId: item.brandId, error: (error as Error).message });
    }
  }

  return NextResponse.json({ due: due.length, results });
}

/** Vercel Cron invokes cron paths with GET and the CRON_SECRET bearer header. */
export const GET = POST;
