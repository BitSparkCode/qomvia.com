import * as cheerio from "cheerio";

export type ParsedProduct = {
  externalId: string;
  title: string;
  description?: string;
  category?: string;
  vendor?: string;
  priceCents?: number;
  currency?: string;
  gtin?: string;
  url?: string;
  imageUrl?: string;
};

export const MAX_IMPORT_PRODUCTS = 2000;

function text(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** "CHF 129.90", "129,90 CHF", "129.90" → 12990. */
export function parsePriceCents(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const match = raw.replace(/\s/g, "").match(/-?\d+(?:[.,]\d{1,2})?/);
  if (!match) return undefined;
  const amount = Number(match[0].replace(",", "."));
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(amount * 100);
}

export function parseCurrency(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const match = raw.toUpperCase().match(/\b(CHF|EUR|USD|GBP|SEK|DKK|NOK|PLN)\b/);
  return match ? match[1] : undefined;
}

/**
 * Splits a CSV row honouring double-quoted fields and embedded doubled quotes.
 */
export function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

const CSV_ALIASES: Record<keyof ParsedProduct, string[]> = {
  externalId: ["id", "sku", "handle", "variant sku", "item id", "product id"],
  title: ["title", "name", "product title", "product name"],
  description: ["description", "body (html)", "body", "product description"],
  category: ["category", "type", "product type", "product category", "google product category"],
  vendor: ["vendor", "brand", "manufacturer"],
  priceCents: ["price", "variant price", "sale price"],
  currency: ["currency", "price currency"],
  gtin: ["gtin", "ean", "barcode", "variant barcode", "upc", "mpn"],
  url: ["link", "url", "product url", "product link"],
  imageUrl: ["image link", "image", "image src", "image url"],
};

function columnIndex(header: string[], field: keyof ParsedProduct): number {
  for (const alias of CSV_ALIASES[field]) {
    const index = header.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * Parses a Shopify product export or a generic product CSV. Column names are
 * matched case-insensitively against known aliases, so merchants can upload the
 * file their platform gives them without renaming anything.
 */
export function parseProductCsv(csv: string): ParsedProduct[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0]).map((cell) => cell.toLowerCase());
  const indexes = Object.fromEntries(
    (Object.keys(CSV_ALIASES) as (keyof ParsedProduct)[]).map((field) => [field, columnIndex(header, field)]),
  ) as Record<keyof ParsedProduct, number>;
  if (indexes.title < 0) return [];

  const products: ParsedProduct[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    if (products.length >= MAX_IMPORT_PRODUCTS) break;
    const cells = splitCsvRow(line);
    const cell = (field: keyof ParsedProduct) => (indexes[field] >= 0 ? text(cells[indexes[field]]) : undefined);
    const title = cell("title");
    if (!title) continue;
    const externalId = cell("externalId") ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    products.push({
      externalId,
      title,
      description: stripHtml(cell("description")),
      category: cell("category"),
      vendor: cell("vendor"),
      priceCents: parsePriceCents(cell("priceCents")),
      currency: parseCurrency(cell("currency")) ?? parseCurrency(cell("priceCents")),
      gtin: cell("gtin"),
      url: cell("url"),
      imageUrl: cell("imageUrl"),
    });
  }
  return products;
}

/** Google Merchant / RSS 2.0 product feed. */
export function parseProductFeedXml(xml: string): ParsedProduct[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const products: ParsedProduct[] = [];
  const seen = new Set<string>();

  $("item, entry").each((_index, element) => {
    if (products.length >= MAX_IMPORT_PRODUCTS) return;
    const node = $(element);
    const pick = (...selectors: string[]) => {
      for (const selector of selectors) {
        const value = text(node.children(selector).first().text());
        if (value) return value;
      }
      return undefined;
    };
    const title = pick("title", "g\\:title");
    if (!title) return;
    const externalId =
      pick("g\\:id", "id", "guid") ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
    if (seen.has(externalId)) return;
    seen.add(externalId);
    const price = pick("g\\:price", "price", "g\\:sale_price");
    products.push({
      externalId,
      title,
      description: stripHtml(pick("g\\:description", "description")),
      category: pick("g\\:product_type", "g\\:google_product_category", "product_type"),
      vendor: pick("g\\:brand", "brand"),
      priceCents: parsePriceCents(price),
      currency: parseCurrency(price),
      gtin: pick("g\\:gtin", "gtin", "g\\:mpn"),
      url: pick("link", "g\\:link"),
      imageUrl: pick("g\\:image_link", "image_link"),
    });
  });

  return products;
}

type ShopifyProduct = {
  id?: number | string;
  handle?: string;
  title?: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  variants?: { price?: string; barcode?: string; sku?: string }[];
  images?: { src?: string }[];
};

/** Shopify's public `/products.json`, which needs no credentials. */
export function parseShopifyProducts(json: unknown, origin?: string): ParsedProduct[] {
  const payload = json as { products?: ShopifyProduct[] };
  if (!Array.isArray(payload?.products)) return [];
  return payload.products.slice(0, MAX_IMPORT_PRODUCTS).flatMap((product) => {
    const title = text(product.title);
    if (!title) return [];
    const variant = product.variants?.[0];
    return [
      {
        externalId: text(product.id) ?? text(product.handle) ?? title,
        title,
        description: stripHtml(product.body_html),
        category: text(product.product_type),
        vendor: text(product.vendor),
        priceCents: parsePriceCents(variant?.price),
        currency: undefined,
        gtin: text(variant?.barcode) ?? text(variant?.sku),
        url: origin && product.handle ? `${origin}/products/${product.handle}` : undefined,
        imageUrl: text(product.images?.[0]?.src),
      },
    ];
  });
}

export function stripHtml(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const stripped = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped.slice(0, 1000) : undefined;
}
