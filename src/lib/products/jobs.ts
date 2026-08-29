import { prisma } from "@/lib/db";
import { safeFetch } from "@/lib/http";
import { extractJsonLd, findByType } from "@/lib/rubric/extract";
import {
  MAX_IMPORT_PRODUCTS,
  parseCurrency,
  parsePriceCents,
  parseProductFeedXml,
  parseShopifyProducts,
  stripHtml,
  type ParsedProduct,
} from "./parse";

/** A competitor is compared, not managed, so its catalogue is sampled rather than mirrored. */
export const MAX_WATCHED_PRODUCTS = 200;

const MAX_ATTEMPTS = 3;
const MAX_PRODUCT_PAGES = 60;

export type JobState = "queued" | "discovering" | "fetching" | "parsing" | "done" | "failed";

export function productBudget(kind: string): number {
  return kind === "owned" ? MAX_IMPORT_PRODUCTS : MAX_WATCHED_PRODUCTS;
}

export async function enqueueImport(brandId: string, kind: string): Promise<string> {
  const pending = await prisma.importJob.findFirst({
    where: { brandId, state: { in: ["queued", "discovering", "fetching", "parsing"] } },
    select: { id: true },
  });
  if (pending) return pending.id;

  const job = await prisma.importJob.create({
    data: { brandId, kind, maxProducts: productBudget(kind) },
    select: { id: true },
  });
  return job.id;
}

async function advance(jobId: string, state: JobState, data: Record<string, unknown> = {}) {
  await prisma.importJob.update({ where: { id: jobId }, data: { state, ...data } });
}

async function persist(brandId: string, source: string, products: ParsedProduct[], budget: number): Promise<number> {
  let imported = 0;
  for (const product of products.slice(0, budget)) {
    const data = {
      title: product.title,
      description: product.description ?? null,
      category: product.category ?? null,
      vendor: product.vendor ?? null,
      priceCents: product.priceCents ?? null,
      currency: product.currency ?? null,
      gtin: product.gtin ?? null,
      url: product.url ?? null,
      imageUrl: product.imageUrl ?? null,
      source,
    };
    await prisma.product.upsert({
      where: { brandId_externalId: { brandId, externalId: product.externalId } },
      create: { brandId, externalId: product.externalId, ...data },
      update: data,
    });
    imported += 1;
  }
  return imported;
}

/** Feeds first, sitemap second, single product pages last: cheapest complete source wins. */
async function discover(domain: string): Promise<{ source: string; url: string } | null> {
  const candidates: { source: string; url: string }[] = [
    { source: "shopify", url: `https://${domain}/products.json?limit=250` },
    { source: "feed", url: `https://${domain}/feed/products.xml` },
    { source: "feed", url: `https://${domain}/googlebase.xml` },
  ];
  for (const candidate of candidates) {
    const outcome = await safeFetch(candidate.url, { accept: "application/json,application/xml;q=0.9,*/*;q=0.8" });
    if (!outcome.ok) continue;
    if (candidate.source === "shopify" && outcome.body.trimStart().startsWith("{")) return candidate;
    if (candidate.source === "feed" && outcome.body.includes("<item")) return candidate;
  }

  const sitemap = await safeFetch(`https://${domain}/sitemap.xml`, { accept: "application/xml,text/xml" });
  if (sitemap.ok && sitemap.body.includes("<loc")) return { source: "sitemap", url: sitemap.finalUrl };
  return null;
}

function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
}

function looksLikeProductUrl(url: string): boolean {
  return /\/(products?|produkt|produkte|artikel|shop|p)\//i.test(url);
}

/** Walks a sitemap (index included) for product URLs, then reads JSON-LD off each page. */
async function fromSitemap(startUrl: string, budget: number, skip: (url: string) => boolean) {
  const root = await safeFetch(startUrl, { accept: "application/xml,text/xml" });
  if (!root.ok) return { found: 0, products: [] as ParsedProduct[] };

  let urls = locations(root.body);
  if (root.body.includes("<sitemapindex")) {
    const children = urls.filter((url) => /product|produkt|artikel/i.test(url)).slice(0, 3);
    urls = [];
    for (const child of children.length > 0 ? children : locations(root.body).slice(0, 3)) {
      const nested = await safeFetch(child, { accept: "application/xml,text/xml" });
      if (nested.ok) urls.push(...locations(nested.body));
    }
  }

  const productUrls = urls.filter(looksLikeProductUrl);
  const pending = productUrls.filter((url) => !skip(url)).slice(0, Math.min(budget, MAX_PRODUCT_PAGES));
  const products: ParsedProduct[] = [];

  for (const url of pending) {
    const page = await safeFetch(url);
    if (!page.ok) continue;
    const nodes = findByType(extractJsonLd(page.body), "Product");
    for (const node of nodes) {
      const title = stripHtml(node.name);
      if (!title) continue;
      const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      const offerRecord = offer && typeof offer === "object" ? (offer as Record<string, unknown>) : {};
      products.push({
        externalId: url,
        title,
        description: stripHtml(node.description),
        priceCents: parsePriceCents(offerRecord.price),
        currency: parseCurrency(offerRecord.priceCurrency),
        gtin: typeof node.gtin13 === "string" ? node.gtin13 : undefined,
        url,
      });
      break;
    }
  }

  return { found: productUrls.length, products };
}

async function process(jobId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId }, include: { brand: true } });
  if (!job) return;
  const domain = job.brand.domain.replace(/^www\./, "");

  await advance(jobId, "discovering", { startedAt: new Date(), attempts: { increment: 1 } });
  const source = job.sourceUrl
    ? { source: job.source ?? "sitemap", url: job.sourceUrl }
    : await discover(domain);
  if (!source) {
    await advance(jobId, "failed", { error: "No feed, catalogue endpoint or product sitemap found.", finishedAt: new Date() });
    return;
  }

  await advance(jobId, "fetching", { source: source.source, sourceUrl: source.url });

  if (source.source === "sitemap") {
    const existing = await prisma.product.findMany({ where: { brandId: job.brandId }, select: { externalId: true } });
    const seen = new Set(existing.map((row) => row.externalId));
    const budget = Math.max(job.maxProducts - seen.size, 0);
    const { found, products } = await fromSitemap(source.url, budget, (url) => seen.has(url));
    await advance(jobId, "parsing", { itemsFound: found });
    const imported = await persist(job.brandId, "jsonld", products, budget);
    const total = seen.size + imported;
    await advance(jobId, total >= Math.min(found, job.maxProducts) ? "done" : "queued", {
      itemsImported: total,
      finishedAt: total >= Math.min(found, job.maxProducts) ? new Date() : null,
    });
    return;
  }

  const outcome = await safeFetch(source.url, { accept: "application/json,application/xml,*/*;q=0.8" });
  if (!outcome.ok) {
    await advance(jobId, "failed", { error: `Source returned ${outcome.status || "no response"}.`, finishedAt: new Date() });
    return;
  }

  await advance(jobId, "parsing");
  const products =
    source.source === "shopify"
      ? parseShopifyProducts(JSON.parse(outcome.body), new URL(outcome.finalUrl).origin)
      : parseProductFeedXml(outcome.body);

  const imported = await persist(job.brandId, source.source, products, job.maxProducts);
  await advance(jobId, "done", { itemsFound: products.length, itemsImported: imported, finishedAt: new Date() });
}

/**
 * Drains one job. Claiming is a conditional update, so two workers (a cron tick
 * and a dashboard click) cannot run the same job twice.
 */
export async function runNextImportJob(): Promise<string | null> {
  const candidate = await prisma.importJob.findFirst({
    where: { state: "queued", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return null;

  const claimed = await prisma.importJob.updateMany({
    where: { id: candidate.id, state: "queued" },
    data: { state: "discovering" },
  });
  if (claimed.count === 0) return null;

  try {
    await process(candidate.id);
  } catch (error) {
    const job = await prisma.importJob.findUnique({ where: { id: candidate.id }, select: { attempts: true } });
    const exhausted = (job?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;
    await advance(candidate.id, exhausted ? "failed" : "queued", {
      error: (error as Error).message.slice(0, 500),
      finishedAt: exhausted ? new Date() : null,
    });
  }
  return candidate.id;
}

export async function importJobs(brandId: string, limit = 3) {
  return prisma.importJob.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, state: true, source: true, itemsFound: true, itemsImported: true, error: true, createdAt: true },
  });
}
