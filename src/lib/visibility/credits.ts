import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { VISIBILITY_PLANS } from "@/lib/visibility/plans";

const GRANT_PERIOD_DAYS = 30;

export async function creditBalance(brandId: string): Promise<number> {
  const total = await prisma.creditEntry.aggregate({ where: { brandId }, _sum: { delta: true } });
  return total._sum.delta ?? 0;
}

/** Tops a brand up to its plan allowance, at most once per period. */
export async function grantPlanCredits(brandId: string, tier: PlanTier): Promise<number> {
  const reason = `plan:${tier}`;
  const since = new Date(Date.now() - GRANT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const existing = await prisma.creditEntry.findFirst({
    where: { brandId, reason, createdAt: { gte: since } },
    select: { id: true },
  });
  if (existing) return 0;

  const credits = VISIBILITY_PLANS[tier].monthlyCredits;
  if (credits <= 0) return 0;
  await prisma.creditEntry.create({ data: { brandId, delta: credits, reason } });
  return credits;
}

export async function addCredits(brandId: string, credits: number, reason: string): Promise<void> {
  if (credits <= 0) return;
  await prisma.creditEntry.create({ data: { brandId, delta: credits, reason } });
}

export async function consumeCredits(brandId: string, credits: number, runId: string): Promise<void> {
  if (credits <= 0) return;
  await prisma.creditEntry.create({ data: { brandId, delta: -credits, reason: "run", runId } });
}

/**
 * Debits a run before any provider call, so two concurrent runs cannot spend the
 * same balance. Serializable isolation makes the read-then-write atomic.
 */
export async function reserveCredits(brandId: string, credits: number, runId: string): Promise<void> {
  if (credits <= 0) return;
  await prisma.$transaction(
    async (tx) => {
      const total = await tx.creditEntry.aggregate({ where: { brandId }, _sum: { delta: true } });
      if ((total._sum.delta ?? 0) < credits) {
        throw new Error("Out of credits — top up to run the next visibility scan.");
      }
      await tx.creditEntry.create({ data: { brandId, delta: -credits, reason: "run", runId } });
    },
    { isolationLevel: "Serializable" },
  );
}

/** Returns unspent credits when a run fails before it produced any answers. */
export async function refundCredits(brandId: string, credits: number, runId: string): Promise<void> {
  if (credits <= 0) return;
  await prisma.creditEntry.create({ data: { brandId, delta: credits, reason: "run-refund", runId } });
}
