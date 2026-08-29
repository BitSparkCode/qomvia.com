import { AI_AGENTS } from "@/lib/robots";

export type Snippet = { filename: string; language: string; body: string };

/**
 * Copy-pasteable version of a fix, filled with the shop's own domain so the
 * report hands over a file instead of an instruction.
 */
export function snippetFor(signalId: string, domain: string): Snippet | null {
  const origin = `https://${domain}`;

  switch (signalId) {
    case "robots_ai_crawlers":
    case "robots_product_paths":
      return {
        filename: "robots.txt",
        language: "text",
        body: [
          ...AI_AGENTS.flatMap((agent) => [`User-agent: ${agent}`, "Allow: /", ""]),
          `Sitemap: ${origin}/sitemap.xml`,
        ].join("\n"),
      };

    case "llms_txt":
      return {
        filename: "llms.txt",
        language: "markdown",
        body: [
          `# ${domain}`,
          "",
          "> One line on what you sell and who you ship to.",
          "",
          "## Catalogue",
          `- [All products](${origin}/sitemap.xml): every product URL`,
          `- [Product feed](${origin}/products.json): price, availability and identifiers`,
          "",
          "## Policies",
          `- [Shipping and returns](${origin}/policies/shipping)`,
          `- [Automated access](${origin}/ai-policy)`,
          "",
          "## Contact",
          `- hello@${domain}`,
        ].join("\n"),
      };

    case "jsonld_offer":
    case "jsonld_product":
    case "stable_identifiers":
      return {
        filename: "product page <head>",
        language: "html",
        body: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Merino Runner 2",
  "image": ["${origin}/img/merino-runner-2.jpg"],
  "description": "One sentence a shopper would recognise.",
  "sku": "MR2-42-BLK",
  "gtin13": "7612345678904",
  "brand": { "@type": "Brand", "name": "Your brand" },
  "offers": {
    "@type": "Offer",
    "url": "${origin}/products/merino-runner-2",
    "price": "189.00",
    "priceCurrency": "CHF",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition"
  }
}
</script>`,
      };

    case "category_itemlist":
      return {
        filename: "category page <head>",
        language: "html",
        body: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "url": "${origin}/products/merino-runner-2" },
    { "@type": "ListItem", "position": 2, "url": "${origin}/products/merino-runner-3" }
  ]
}
</script>`,
      };

    case "mcp_discovery":
      return {
        filename: ".well-known/mcp.json",
        language: "json",
        body: `{
  "name": "${domain}",
  "description": "Search and order products from ${domain}.",
  "version": "1.0.0",
  "endpoint": "${origin}/mcp",
  "transport": "streamable-http",
  "tools": [
    { "name": "search_products", "description": "Search the catalogue by keywords, size and price." },
    { "name": "get_product", "description": "Return price, availability and identifiers for one product." }
  ],
  "contact": "hello@${domain}"
}`,
      };

    case "ai_policy":
      return {
        filename: "/ai-policy",
        language: "markdown",
        body: [
          "# Automated access policy",
          "",
          `AI assistants and shopping agents may read every public page of ${domain}, quote prices and`,
          "availability, and place orders through our guest checkout on a customer's behalf.",
          "",
          "- Crawl rate: up to 1 request per second.",
          `- Identify yourself with a descriptive user agent and a contact URL.`,
          `- Problems or access requests: hello@${domain}.`,
        ].join("\n"),
      };

    case "machine_contact":
      return {
        filename: ".well-known/security.txt",
        language: "text",
        body: [
          `Contact: mailto:security@${domain}`,
          `Policy: ${origin}/ai-policy`,
          "Preferred-Languages: de, en",
          `Expires: ${new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 19)}Z`,
        ].join("\n"),
      };

    case "form_semantics":
      return {
        filename: "checkout form",
        language: "html",
        body: `<input name="email" type="email" autocomplete="email" required>
<input name="given-name" autocomplete="given-name" required>
<input name="family-name" autocomplete="family-name" required>
<input name="address" autocomplete="street-address" required>
<input name="postal-code" autocomplete="postal-code" inputmode="numeric" required>
<input name="city" autocomplete="address-level2" required>
<select name="country" autocomplete="country"></select>`,
      };

    case "product_feed":
      return {
        filename: "products.json",
        language: "json",
        body: `{
  "products": [
    {
      "id": "MR2-42-BLK",
      "gtin13": "7612345678904",
      "title": "Merino Runner 2",
      "url": "${origin}/products/merino-runner-2",
      "price": "189.00",
      "currency": "CHF",
      "availability": "in_stock",
      "image": "${origin}/img/merino-runner-2.jpg"
    }
  ]
}`,
      };

    case "sitemap":
      return {
        filename: "robots.txt (add this line)",
        language: "text",
        body: `Sitemap: ${origin}/sitemap.xml`,
      };

    default:
      return null;
  }
}
