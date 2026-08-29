import { describe, expect, it } from "vitest";
import {
  countSitemapUrls,
  detectPlatform,
  extractJsonLd,
  findByType,
  guessCheckoutUrl,
  guessProductUrl,
  snapshot,
} from "@/lib/rubric/extract";
import { outcome } from "@/lib/__tests__/fixtures";

const PRODUCT_HTML = `<!doctype html><html><head><title>Shoe</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"Product","name":"Shoe","sku":"S-1","gtin13":"0123456789012",
   "offers":{"@type":"Offer","price":"99.00","priceCurrency":"CHF","availability":"https://schema.org/InStock"}}]}</script>
<script type="application/ld+json">{ broken json </script>
</head><body><p>A running shoe.</p>
<a href="/products/shoe-2">Another</a><a href="/cart">Cart</a><a href="https://other.com/x">Off-site</a>
<form action="/checkout" method="post"><input name="email" type="email" autocomplete="email"></form>
</body></html>`;

describe("extractJsonLd", () => {
  it("flattens @graph and nested offers while ignoring malformed blocks", () => {
    const nodes = extractJsonLd(PRODUCT_HTML);
    const products = findByType(nodes, "Product");
    expect(products.length).toBe(1);
    expect(findByType(nodes, "Offer").length).toBe(1);
    expect(products[0].sku).toBe("S-1");
  });
});

describe("snapshot", () => {
  const page = snapshot(outcome({ body: PRODUCT_HTML, finalUrl: "https://example.com/products/shoe" }));

  it("reads title, text length, forms and absolute links", () => {
    expect(page.title).toBe("Shoe");
    expect(page.textLength).toBeGreaterThan(10);
    expect(page.forms[0].inputs[0].autocomplete).toBe("email");
    expect(page.links).toContain("https://example.com/cart");
    expect(page.links).toContain("https://other.com/x");
  });

  it("excludes script content from the agent-visible text length", () => {
    expect(page.textLength).toBeLessThan(200);
  });
});

describe("url guessing", () => {
  const page = snapshot(outcome({ body: PRODUCT_HTML, finalUrl: "https://example.com/" }));

  it("prefers same-origin candidates", () => {
    expect(guessProductUrl(page.links, "https://example.com")).toBe("https://example.com/products/shoe-2");
    expect(guessCheckoutUrl(page.links, "https://example.com")).toBe("https://example.com/cart");
    expect(guessProductUrl(page.links, "https://shop.example.com")).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("identifies platforms from markup or headers", () => {
    expect(detectPlatform('<script src="https://cdn.shopify.com/x.js">', {})).toBe("Shopify");
    expect(detectPlatform("", { "x-powered-by": "Shopware 6" })).toBe("Shopware");
    expect(detectPlatform("<html></html>", {})).toBeNull();
  });
});

describe("countSitemapUrls", () => {
  it("distinguishes a sitemap index from a url set", () => {
    const index = countSitemapUrls(
      "<sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>",
    );
    expect(index.isIndex).toBe(true);
    expect(index.children).toEqual(["https://example.com/s1.xml"]);

    const urlset = countSitemapUrls("<urlset><url><loc>https://example.com/a</loc></url></urlset>");
    expect(urlset.isIndex).toBe(false);
    expect(urlset.urlCount).toBe(1);
  });
});
