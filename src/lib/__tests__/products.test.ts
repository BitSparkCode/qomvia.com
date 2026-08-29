import { describe, expect, it } from "vitest";
import {
  parseCurrency,
  parsePriceCents,
  parseProductCsv,
  parseProductFeedXml,
  parseShopifyProducts,
  splitCsvRow,
  stripHtml,
} from "@/lib/products/parse";

describe("price and currency parsing", () => {
  it("reads prices in both decimal conventions", () => {
    expect(parsePriceCents("189.00")).toBe(18900);
    expect(parsePriceCents("1'289.90 CHF")).toBe(128990);
    expect(parsePriceCents("1.289,90")).toBe(128990);
    expect(parsePriceCents("")).toBeUndefined();
    expect(parsePriceCents("free")).toBeUndefined();
  });

  it("only accepts three-letter currency codes", () => {
    expect(parseCurrency("189.00 CHF")).toBe("CHF");
    expect(parseCurrency("eur")).toBe("EUR");
    expect(parseCurrency("$$")).toBeUndefined();
  });
});

describe("csv parsing", () => {
  it("respects quoted commas", () => {
    expect(splitCsvRow('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
    expect(splitCsvRow('a,"say ""hi""",b')).toEqual(["a", 'say "hi"', "b"]);
  });

  it("maps recognised headers", () => {
    const products = parseProductCsv(
      ["id,title,category,price,currency,link", "SKU-1,Merino Runner,Shoes,189.00,CHF,https://shop.test/p/1"].join("\n"),
    );
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalId: "SKU-1",
      title: "Merino Runner",
      category: "Shoes",
      priceCents: 18900,
      currency: "CHF",
      url: "https://shop.test/p/1",
    });
  });

  it("skips rows without a title", () => {
    expect(parseProductCsv("id,title\nSKU-1,\nSKU-2,Cap")).toHaveLength(1);
  });
});

describe("feed parsing", () => {
  it("reads a google merchant style feed", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <g:id>A1</g:id><title>Wool Jacket</title>
        <g:price>249.00 CHF</g:price>
        <g:product_type>Jackets</g:product_type>
        <link>https://shop.test/jacket</link>
        <g:gtin>07612345678900</g:gtin>
      </item>
    </channel></rss>`;
    const products = parseProductFeedXml(xml);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      externalId: "A1",
      title: "Wool Jacket",
      priceCents: 24900,
      currency: "CHF",
      category: "Jackets",
      gtin: "07612345678900",
    });
  });
});

describe("shopify parsing", () => {
  it("takes the first variant price and builds absolute urls", () => {
    const products = parseShopifyProducts(
      {
        products: [
          {
            id: 12,
            title: "Trail Cap",
            handle: "trail-cap",
            product_type: "Caps",
            vendor: "Testbrand",
            body_html: "<p>Light <b>cap</b></p>",
            variants: [{ price: "39.90", sku: "CAP-1" }],
            images: [{ src: "https://cdn.test/cap.jpg" }],
          },
        ],
      },
      "https://shop.test",
    );
    expect(products[0]).toMatchObject({
      externalId: "12",
      title: "Trail Cap",
      category: "Caps",
      vendor: "Testbrand",
      priceCents: 3990,
      url: "https://shop.test/products/trail-cap",
      imageUrl: "https://cdn.test/cap.jpg",
    });
    expect(products[0].description).toBe("Light cap");
  });

  it("ignores payloads that are not shopify products", () => {
    expect(parseShopifyProducts({ nope: true })).toEqual([]);
  });
});

describe("stripHtml", () => {
  it("collapses markup and whitespace", () => {
    expect(stripHtml("<p>Hello   <br>world</p>")).toBe("Hello world");
    expect(stripHtml("")).toBeUndefined();
  });
});
