import * as cheerio from "cheerio";
import type { FetchOutcome } from "@/lib/http";
import type { JsonLdNode, PageSnapshot } from "./types";

function flatten(node: unknown, sink: JsonLdNode[]) {
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, sink);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as JsonLdNode;
  sink.push(record);
  if (Array.isArray(record["@graph"])) flatten(record["@graph"], sink);
  for (const key of ["mainEntity", "itemListElement", "offers", "hasVariant", "item"]) {
    if (key in record) flatten(record[key], sink);
  }
}

export function extractJsonLd(html: string): JsonLdNode[] {
  const $ = cheerio.load(html);
  const nodes: JsonLdNode[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw.trim()) return;
    try {
      flatten(JSON.parse(raw), nodes);
    } catch {
      // Malformed JSON-LD is itself a finding; the structured-data signals treat it as absent.
    }
  });
  return nodes;
}

export function hasType(node: JsonLdNode, type: string): boolean {
  const value = node["@type"];
  if (typeof value === "string") return value.toLowerCase() === type.toLowerCase();
  if (Array.isArray(value)) return value.some((item) => String(item).toLowerCase() === type.toLowerCase());
  return false;
}

export function findByType(nodes: JsonLdNode[], type: string): JsonLdNode[] {
  return nodes.filter((node) => hasType(node, type));
}

export function snapshot(outcome: FetchOutcome): PageSnapshot {
  const html = outcome.body;
  const $ = cheerio.load(html);
  const base = outcome.finalUrl || outcome.url;
  const title = $("title").first().text().trim();
  const jsonLd = extractJsonLd(html);

  const forms = $("form")
    .map((_, element) => {
      const form = $(element);
      return {
        action: form.attr("action") ?? "",
        method: (form.attr("method") ?? "get").toLowerCase(),
        inputs: form
          .find("input,select,textarea")
          .map((__, input) => ({
            name: $(input).attr("name") ?? "",
            type: $(input).attr("type") ?? input.tagName.toLowerCase(),
            autocomplete: $(input).attr("autocomplete") ?? "",
          }))
          .get(),
      };
    })
    .get();

  const links = Array.from(
    new Set(
      $("a[href]")
        .map((_, element) => $(element).attr("href") ?? "")
        .get()
        .map((href) => {
          try {
            return new URL(href, base).toString();
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  );

  $("script,style,noscript,template,svg").remove();
  const textLength = $("body").text().replace(/\s+/g, " ").trim().length;

  return { url: base, outcome, jsonLd, textLength, title, forms, links };
}

const PRODUCT_HINTS = ["/product", "/products/", "/p/", "/artikel", "/produkt", "/dp/", "/item"];
const CATEGORY_HINTS = ["/collection", "/category", "/kategorie", "/shop", "/c/", "/catalog", "/damen", "/herren"];
const CHECKOUT_HINTS = ["/cart", "/checkout", "/basket", "/warenkorb", "/panier"];

function pick(links: string[], origin: string, hints: string[]): string | null {
  const sameOrigin = links.filter((link) => link.startsWith(origin));
  for (const hint of hints) {
    const match = sameOrigin.find((link) => new URL(link).pathname.toLowerCase().includes(hint));
    if (match) return match;
  }
  return null;
}

export function guessProductUrl(links: string[], origin: string) {
  return pick(links, origin, PRODUCT_HINTS);
}
export function guessCategoryUrl(links: string[], origin: string) {
  return pick(links, origin, CATEGORY_HINTS);
}
export function guessCheckoutUrl(links: string[], origin: string) {
  return pick(links, origin, CHECKOUT_HINTS);
}

export function detectPlatform(html: string, headers: Record<string, string>): string | null {
  const haystack = `${html.slice(0, 200_000)} ${JSON.stringify(headers)}`.toLowerCase();
  if (haystack.includes("cdn.shopify.com") || haystack.includes("shopify")) return "Shopify";
  if (haystack.includes("woocommerce")) return "WooCommerce";
  if (haystack.includes("magento")) return "Magento";
  if (haystack.includes("salesforce commerce") || haystack.includes("demandware")) return "SFCC";
  if (haystack.includes("shopware")) return "Shopware";
  if (haystack.includes("bigcommerce")) return "BigCommerce";
  if (haystack.includes("commercetools")) return "commercetools";
  return null;
}

export function countSitemapUrls(xml: string): { urlCount: number; isIndex: boolean; children: string[] } {
  const isIndex = /<sitemapindex/i.test(xml);
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((match) => match[1]);
  return { urlCount: locs.length, isIndex, children: isIndex ? locs.slice(0, 5) : [] };
}
