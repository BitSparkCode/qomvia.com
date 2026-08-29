import { prisma } from "@/lib/db";
import { safeFetch } from "@/lib/http";
import {
  MAX_IMPORT_PRODUCTS,
  parseProductCsv,
  parseProductFeedXml,
  parseShopifyProducts,
  type ParsedProduct,
} from "./parse";

export type ImportSource = "csv" | "feed" | "shopify";

export type ImportResult = { importId: string; source: ImportSource; products: number };

async function persist(brandId: string, source: ImportSource, sourceUrl: string | null, products: ParsedProduct[]) {
  const record = await prisma.productImport.create({
    data: { brandId, source, sourceUrl, status: "running" },
  });

  const capped = products.slice(0, MAX_IMPORT_PRODUCTS);
  for (const product of capped) {
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
  }

  await prisma.productImport.update({
    where: { id: record.id },
    data: { status: "complete", productCount: capped.length, finishedAt: new Date() },
  });

  return { importId: record.id, source, products: capped.length };
}

export async function importFromCsv(brandId: string, csv: string): Promise<ImportResult> {
  const products = parseProductCsv(csv);
  if (products.length === 0) {
    throw new Error("No products found. The file needs a header row with at least a title/name column.");
  }
  return persist(brandId, "csv", null, products);
}

/**
 * Imports from a public feed URL: a Google Merchant/RSS XML feed, a Shopify
 * `products.json`, or anything served as CSV. Uses the same SSRF-safe fetch as
 * the crawler, so a submitted URL can never point at private infrastructure.
 */
export async function importFromUrl(brandId: string, url: string): Promise<ImportResult> {
  const outcome = await safeFetch(url, { accept: "application/json,application/xml,text/csv,*/*;q=0.8" });
  if (!outcome.ok) throw new Error(`Feed returned ${outcome.status || "no response"}${outcome.error ? `: ${outcome.error}` : ""}`);

  const contentType = outcome.headers["content-type"] ?? "";
  const body = outcome.body;

  if (contentType.includes("json") || body.trimStart().startsWith("{")) {
    const origin = new URL(outcome.finalUrl).origin;
    const products = parseShopifyProducts(JSON.parse(body), origin);
    if (products.length > 0) return persist(brandId, "shopify", url, products);
  }

  if (body.includes("<item") || body.includes("<entry") || contentType.includes("xml")) {
    const products = parseProductFeedXml(body);
    if (products.length > 0) return persist(brandId, "feed", url, products);
  }

  const products = parseProductCsv(body);
  if (products.length > 0) return persist(brandId, "csv", url, products);

  throw new Error("Could not read any products from that URL. Supported: Google Merchant XML, Shopify products.json, CSV.");
}

/** Tries the Shopify catalogue endpoint every Shopify store exposes publicly. */
export async function importFromShopifyDomain(brandId: string, domain: string): Promise<ImportResult> {
  return importFromUrl(brandId, `https://${domain}/products.json?limit=250`);
}
