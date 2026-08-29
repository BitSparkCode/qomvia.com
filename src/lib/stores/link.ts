import { prisma } from "@/lib/db";
import { normalizeDomain } from "@/lib/http";
import { upsertBrand } from "@/lib/scan-service";
import { enqueueImport } from "@/lib/products/jobs";

export type StoreKind = "owned" | "watched";

/** One watched domain is free so the comparison is discovered before it is billed. */
export const FREE_WATCHED_STORES = 1;

/**
 * A watched domain is only useful next to your own numbers, so it is registered
 * as a tracked competitor of every store the account has verified.
 */
async function trackAgainstOwnedStores(userId: string, domain: string): Promise<void> {
  const owned = await prisma.storeLink.findMany({
    where: { userId, kind: "owned", NOT: { verifiedAt: null } },
    select: { brandId: true },
  });
  for (const { brandId } of owned) {
    await prisma.competitor.upsert({
      where: { brandId_name: { brandId, name: domain } },
      create: { brandId, name: domain, domain, tracked: true },
      update: { tracked: true, domain },
    });
  }
}

export type AttachResult = { ok: string; brandId: string } | { error: string };

async function watchedAllowance(userId: string): Promise<number> {
  const memberships = await prisma.brandMember.findMany({ where: { userId }, select: { brandId: true } });
  const paid = await prisma.competitorSlot.count({
    where: { brandId: { in: memberships.map((row) => row.brandId) }, status: "active" },
  });
  return FREE_WATCHED_STORES + paid;
}

/**
 * Attaching is a row, not a flag: a store stays on the account until it is
 * detached. Watched stores need no proof, because every measurement we take of
 * them comes from public responses.
 */
export async function attachStore(userId: string, input: string, kind: StoreKind): Promise<AttachResult> {
  let domain: string;
  try {
    domain = normalizeDomain(input);
  } catch {
    return { error: "Enter a domain, for example kuhteilen.ch." };
  }

  const brand = await upsertBrand(domain);
  if (brand.optedOut) return { error: `${domain} asked to be left out of Qomvia.` };

  const existing = await prisma.storeLink.findUnique({
    where: { userId_brandId: { userId, brandId: brand.id } },
    select: { id: true, kind: true },
  });
  if (existing) return { error: `${domain} is already on your account.` };

  if (kind === "watched") {
    const watched = await prisma.storeLink.count({ where: { userId, kind: "watched" } });
    const allowance = await watchedAllowance(userId);
    if (watched >= allowance) {
      return {
        error: `You are watching ${watched} domain${watched === 1 ? "" : "s"}. Add a competitor slot to watch more.`,
      };
    }
  }

  await prisma.storeLink.create({ data: { userId, brandId: brand.id, kind } });
  await enqueueImport(brand.id, kind);
  if (kind === "watched") await trackAgainstOwnedStores(userId, domain);

  return {
    ok:
      kind === "watched"
        ? `Watching ${domain}. Its catalogue is being imported.`
        : `${domain} attached. Confirm an email at the domain to unlock fixes, re-scans and the seal.`,
    brandId: brand.id,
  };
}

/**
 * Detaching removes what the account added: the link, the competitor rows it
 * created on the account's own stores, and — only when nobody else keeps the
 * store — the scraped catalogue and its import job.
 */
export async function detachStore(userId: string, brandId: string): Promise<void> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { domain: true } });
  await prisma.storeLink.deleteMany({ where: { userId, brandId } });

  if (brand) {
    const owned = await prisma.storeLink.findMany({ where: { userId, kind: "owned" }, select: { brandId: true } });
    await prisma.competitor.deleteMany({
      where: { brandId: { in: owned.map((row) => row.brandId) }, domain: brand.domain },
    });
  }

  const others = await prisma.storeLink.count({ where: { brandId } });
  const members = await prisma.brandMember.count({ where: { brandId } });
  if (others === 0 && members === 0) {
    await prisma.product.deleteMany({ where: { brandId } });
    await prisma.importJob.deleteMany({ where: { brandId } });
  }
}

export async function storeLinks(userId: string) {
  return prisma.storeLink.findMany({
    where: { userId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    include: { brand: { select: { id: true, name: true, domain: true, slug: true } } },
  });
}

export async function watchedStoreBudget(userId: string): Promise<{ used: number; allowance: number }> {
  return {
    used: await prisma.storeLink.count({ where: { userId, kind: "watched" } }),
    allowance: await watchedAllowance(userId),
  };
}
