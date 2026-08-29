import type { Prisma, ScanMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { detectPlatform } from "@/lib/rubric/extract";
import { runScan } from "@/lib/rubric/crawl";
import { normalizeDomain } from "@/lib/http";

export const RESCAN_COOLDOWN_MS = 60 * 60 * 1000;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function brandNameFromDomain(domain: string): string {
  const label = domain.split(".")[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function upsertBrand(rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  const existing = await prisma.brand.findUnique({ where: { domain } });
  if (existing) return existing;
  return prisma.brand.create({
    data: { domain, name: brandNameFromDomain(domain), slug: slugify(domain) },
  });
}

export async function latestScan(brandId: string) {
  return prisma.scan.findFirst({
    where: { brandId, status: "COMPLETE" },
    orderBy: { createdAt: "desc" },
    include: { signals: true },
  });
}

/** Runs a scan, persists it, and records an alert when the score moved. */
export async function scanDomain(rawDomain: string, mode: ScanMode = "SHALLOW") {
  const brand = await upsertBrand(rawDomain);
  if (brand.optedOut) throw new Error("This domain has opted out of public scoring.");

  const previous = await latestScan(brand.id);
  const scan = await prisma.scan.create({
    data: { brandId: brand.id, mode, status: "RUNNING", isPublic: mode === "SHALLOW" },
  });

  try {
    const result = await runScan(brand.domain, mode);
    const platform =
      detectPlatform(result.context.botHome.body, result.context.botHome.headers) ?? brand.platform ?? null;

    const [updated] = await prisma.$transaction([
      prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETE",
          score: result.score,
          grade: result.grade,
          dimensions: result.dimensions as unknown as Prisma.InputJsonValue,
          urlsFetched: result.urlsFetched,
          durationMs: result.durationMs,
          rubricVersion: result.rubricVersion,
          finishedAt: new Date(),
        },
      }),
      prisma.signalResult.createMany({
        data: result.signals.map((signal) => ({
          scanId: scan.id,
          signalId: signal.id,
          dimension: signal.dimension,
          points: signal.points,
          maxPoints: signal.max,
          status: signal.status,
          detail: signal.detail,
          evidence: (signal.evidence ?? {}) as Prisma.InputJsonValue,
        })),
      }),
      prisma.brand.update({ where: { id: brand.id }, data: { platform } }),
    ]);

    if (previous?.score != null && previous.score !== result.score) {
      await prisma.alert.create({
        data: {
          brandId: brand.id,
          kind: "score_change",
          fromScore: previous.score,
          toScore: result.score,
          message: `${brand.name} moved from ${previous.score} to ${result.score} (${result.grade}).`,
        },
      });
    }

    return { brand, scan: updated, result };
  } catch (error) {
    await prisma.scan.update({
      where: { id: scan.id },
      data: { status: "FAILED", error: (error as Error).message, finishedAt: new Date() },
    });
    throw error;
  }
}
