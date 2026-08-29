import { describe, expect, it } from "vitest";
import { MAX_WATCHED_PRODUCTS, fromHtml, fromJsonLd, productBudget } from "@/lib/products/jobs";
import { MAX_IMPORT_PRODUCTS } from "@/lib/products/parse";
import { CLAIM_MAILBOXES } from "@/lib/stores/claim";

describe("import budgets", () => {
  it("samples a competitor instead of mirroring it", () => {
    expect(productBudget("watched")).toBe(MAX_WATCHED_PRODUCTS);
    expect(productBudget("owned")).toBe(MAX_IMPORT_PRODUCTS);
    expect(MAX_WATCHED_PRODUCTS).toBeLessThan(MAX_IMPORT_PRODUCTS);
  });

  it("treats an unknown kind as watched, so an unproved store cannot pull the large budget", () => {
    expect(productBudget("something-else")).toBe(MAX_WATCHED_PRODUCTS);
  });
});

describe("ownership proof", () => {
  it("accepts only administrative mailboxes", () => {
    expect(CLAIM_MAILBOXES).toContain("admin");
    expect(CLAIM_MAILBOXES).not.toContain("marketing");
    expect(CLAIM_MAILBOXES.every((mailbox) => /^[a-z]+$/.test(mailbox))).toBe(true);
  });
});

describe("page-level extraction", () => {
  const jsonLd = `<html><head><script type="application/ld+json">
    {"@type":"Product","name":"Picanha","description":"Cut from the rump cap.",
     "offers":{"@type":"Offer","price":"39.90","priceCurrency":"CHF"}}
  </script></head><body></body></html>`;

  const plain = `<html><head>
    <meta property="og:title" content="Entrecôte 400 g">
    <meta property="product:price:amount" content="42.50">
    <meta property="product:price:currency" content="CHF">
    <meta name="description" content="Dry-aged.">
    </head><body><h1>Entrecôte</h1></body></html>`;

  it("prefers JSON-LD when a shop publishes it", () => {
    const product = fromJsonLd("https://shop.test/products/picanha", jsonLd);
    expect(product?.title).toBe("Picanha");
    expect(product?.priceCents).toBe(3990);
    expect(product?.currency).toBe("CHF");
  });

  it("still reads a shop with no structured data at all", () => {
    expect(fromJsonLd("https://shop.test/products/entrecote", plain)).toBeNull();
    const product = fromHtml("https://shop.test/products/entrecote", plain);
    expect(product?.title).toBe("Entrecôte 400 g");
    expect(product?.priceCents).toBe(4250);
    expect(product?.currency).toBe("CHF");
    expect(product?.externalId).toBe("https://shop.test/products/entrecote");
  });

  it("returns nothing for a page with no title", () => {
    expect(fromHtml("https://shop.test/products/x", "<html><body>hi</body></html>")).toBeNull();
  });
});
