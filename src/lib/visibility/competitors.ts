import { prisma } from "@/lib/db";
import { normalizeDomain } from "@/lib/http";
import { planForBrand } from "@/lib/visibility/run";

export type WatchedCompetitor = { name: string; domain: string };

/** Domains the shop asked us to watch, matched by name as well as by URL in answers. */
export async function watchedCompetitors(brandId: string): Promise<WatchedCompetitor[]> {
  const rows = await prisma.competitor.findMany({
    where: { brandId, tracked: true },
    select: { name: true, domain: true },
  });
  return rows
    .map((row) => ({ name: row.name, domain: row.domain ?? row.name }))
    .filter((row) => row.domain.includes("."));
}

export async function trackedCompetitors(brandId: string) {
  return prisma.competitor.findMany({
    where: { brandId, tracked: true },
    orderBy: [{ mentions: "desc" }, { name: "asc" }],
    select: { id: true, name: true, domain: true, mentions: true, wins: true, bestRank: true, lastSeenAt: true },
  });
}

/** Slots included in the plan plus every slot paid for separately. */
export async function competitorAllowance(brandId: string): Promise<number> {
  const plan = await planForBrand(brandId);
  const paid = await prisma.competitorSlot.count({ where: { brandId, status: "active" } });
  return plan.includedCompetitors + paid;
}

export async function addTrackedCompetitor(
  brandId: string,
  input: string,
): Promise<{ ok: string } | { error: string }> {
  let domain: string;
  try {
    domain = normalizeDomain(input);
  } catch {
    return { error: "Enter a competitor domain, for example zalando.ch." };
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { domain: true } });
  if (!brand) return { error: "Store not found." };
  if (domain === brand.domain.replace(/^www\./, "")) return { error: "That is your own domain." };

  const existing = await prisma.competitor.findUnique({
    where: { brandId_name: { brandId, name: domain } },
    select: { id: true, tracked: true },
  });
  if (existing?.tracked) return { error: `${domain} is already tracked.` };

  const allowance = await competitorAllowance(brandId);
  const tracked = await prisma.competitor.count({ where: { brandId, tracked: true } });
  if (tracked >= allowance) {
    return {
      error:
        allowance === 0
          ? "Competitor tracking is part of the paid plans."
          : `Your plan tracks ${allowance} competitor${allowance === 1 ? "" : "s"}. Add a slot to track more.`,
    };
  }

  if (existing) {
    await prisma.competitor.update({ where: { id: existing.id }, data: { tracked: true, domain } });
  } else {
    await prisma.competitor.create({ data: { brandId, name: domain, domain, tracked: true } });
  }
  return { ok: `Now watching ${domain} in every run.` };
}

export async function untrackCompetitor(brandId: string, competitorId: string): Promise<void> {
  await prisma.competitor.updateMany({ where: { id: competitorId, brandId }, data: { tracked: false } });
}

/** Records a paid slot idempotently, so a replayed webhook cannot grant it twice. */
export async function grantCompetitorSlot(
  brandId: string,
  reference: { subscriptionId?: string; sessionId?: string },
): Promise<void> {
  if (reference.subscriptionId) {
    const existing = await prisma.competitorSlot.findUnique({
      where: { stripeSubscriptionId: reference.subscriptionId },
      select: { id: true },
    });
    if (existing) {
      await prisma.competitorSlot.update({ where: { id: existing.id }, data: { status: "active" } });
      return;
    }
  }
  if (reference.sessionId) {
    const existing = await prisma.competitorSlot.findUnique({
      where: { stripeSessionId: reference.sessionId },
      select: { id: true },
    });
    if (existing) return;
  }
  await prisma.competitorSlot.create({
    data: {
      brandId,
      stripeSubscriptionId: reference.subscriptionId,
      stripeSessionId: reference.sessionId,
      status: "active",
    },
  });
}

export async function cancelCompetitorSlot(subscriptionId: string): Promise<void> {
  await prisma.competitorSlot.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "cancelled" },
  });
}
