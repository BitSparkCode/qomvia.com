import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/leaderboard"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/report"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/methodology"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/bot"), changeFrequency: "monthly", priority: 0.4 },
  ];

  const scans = await prisma.scan.findMany({
    where: { status: "COMPLETE", isPublic: true, score: { not: null }, brand: { optedOut: false } },
    distinct: ["brandId"],
    orderBy: [{ brandId: "asc" }, { createdAt: "desc" }],
    select: { createdAt: true, brand: { select: { slug: true } } },
    take: 45000,
  });

  return [
    ...staticEntries,
    ...scans.map((scan) => ({
      url: absoluteUrl(`/site/${scan.brand.slug}`),
      lastModified: scan.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
