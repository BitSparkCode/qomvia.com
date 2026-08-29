import * as cheerio from "cheerio";
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
const PAGES_PER_RUN = 12;

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

/**
 * A shop without JSON-LD still has a title and a price on the page. Reading
 * those is worse data than a feed, but "no structured data" is exactly the
 * catalogue a competitor most often has, and an empty import tells nobody
 * anything.
 */
export function fromHtml(url: string, html: string): ParsedProduct | null {
  const $ = cheerio.load(html);
  const meta = (selector: string) => $(selector).attr("content")?.trim() || undefined;
  const title =
    meta('meta[property="og:title"]') ??
    stripHtml($("h1").first().text()) ??
    stripHtml($("title").first().text());
  if (!title) return null;

  const priceText =
    meta('meta[property="product:price:amount"]') ??
    meta('meta[itemprop="price"]') ??
    $('[itemprop="price"]').first().attr("content") ??
    $('[itemprop="price"]').first().text() ??
    $('[class*="price" i]').first().text();

  return {
    externalId: url,
    title,
    description: meta('meta[name="description"]') ?? meta('meta[property="og:description"]'),
    priceCents: parsePriceCents(priceText),
    currency: parseCurrency(
      meta('meta[property="product:price:currency"]') ?? meta('meta[itemprop="priceCurrency"]') ?? priceText,
    ),
    url,
    imageUrl: meta('meta[property="og:image"]'),
  };
}

export function fromJsonLd(url: string, html: string): ParsedProduct | null {
  for (const node of findByType(extractJsonLd(html), "Product")) {
    const title = stripHtml(node.name);
    if (!title) continue;
    const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const offerRecord = offer && typeof offer === "object" ? (offer as Record<string, unknown>) : {};
    return {
      externalId: url,
      title,
      description: stripHtml(node.description),
      priceCents: parsePriceCents(offerRecord.price),
      currency: parseCurrency(offerRecord.priceCurrency),
      gtin: typeof node.gtin13 === "string" ? node.gtin13 : undefined,
      url,
    };
  }
  return null;
}

/** Walks a sitemap (index included) for product URLs, then reads each page. */
async function fromSitemap(startUrl: string, budget: number, skip: (url: string) => boolean) {
  const root = await safeFetch(startUrl, { accept: "application/xml,text/xml" });
  if (!root.ok) return { found: 0, pending: 0, products: [] as ParsedProduct[] };

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
  const outstanding = productUrls.filter((url) => !skip(url));
  const batch = outstanding.slice(0, Math.min(budget, PAGES_PER_RUN));
  const products: ParsedProduct[] = [];

  for (const url of batch) {
    const page = await safeFetch(url);
    if (!page.ok) continue;
    const product = fromJsonLd(url, page.body) ?? fromHtml(url, page.body);
    if (product) products.push(product);
  }

  return { found: productUrls.length, pending: outstanding.length, products };
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
    const { found, pending, products } = await fromSitemap(source.url, budget, (url) => seen.has(url));
    await advance(jobId, "parsing", { itemsFound: found });
    const imported = await persist(job.brandId, products[0] ? "page" : "sitemap", products, budget);
    const total = seen.size + imported;
    const complete = budget === 0 || pending <= PAGES_PER_RUN || total >= job.maxProducts;

    if (complete) {
      await advance(jobId, total > 0 ? "done" : "failed", {
        itemsImported: total,
        error: total > 0 ? null : "No product data found on the product pages.",
        finishedAt: new Date(),
      });
      return;
    }
    // A pass that read pages but stored nothing will not do better on retry;
    // saying so beats a queue entry that never moves again.
    if (imported === 0 && job.attempts + 1 >= MAX_ATTEMPTS) {
      await advance(jobId, "failed", {
        itemsImported: total,
        error: "No product data found on the product pages.",
        finishedAt: new Date(),
      });
      return;
    }
    await advance(jobId, "queued", { itemsImported: total, attempts: imported > 0 ? 0 : job.attempts + 1 });
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
 * Runs one job. Claiming is a conditional update, so two workers (a cron tick
 * and a dashboard click) cannot run the same job twice.
 */
async function runImportJob(jobId: string): Promise<string | null> {
  const claimed = await prisma.importJob.updateMany({
    where: { id: jobId, state: "queued" },
    data: { state: "discovering" },
  });
  if (claimed.count === 0) return null;

  try {
    await process(jobId);
  } catch (error) {
    const job = await prisma.importJob.findUnique({ where: { id: jobId }, select: { attempts: true } });
    const exhausted = (job?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;
    await advance(jobId, exhausted ? "failed" : "queued", {
      error: (error as Error).message.slice(0, 500),
      finishedAt: exhausted ? new Date() : null,
    });
  }
  return jobId;
}

export async function runNextImportJob(): Promise<string | null> {
  const candidate = await prisma.importJob.findFirst({
    where: { state: "queued", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return candidate ? runImportJob(candidate.id) : null;
}

/** One pass for one store, so attaching shows progress without draining the queue. */
export async function runImportForBrand(brandId: string): Promise<string | null> {
  const candidate = await prisma.importJob.findFirst({
    where: { brandId, state: "queued" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return candidate ? runImportJob(candidate.id) : null;
}

/** Puts a stalled or failed import back in the queue for another pass. */
export async function retryImport(brandId: string): Promise<void> {
  const job = await prisma.importJob.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!job) return;
  await prisma.importJob.update({
    where: { id: job.id },
    data: { state: "queued", attempts: 0, error: null, finishedAt: null },
  });
}

export async function importJobs(brandId: string, limit = 3) {
  return prisma.importJob.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, state: true, source: true, itemsFound: true, itemsImported: true, error: true, createdAt: true },
  });
}
