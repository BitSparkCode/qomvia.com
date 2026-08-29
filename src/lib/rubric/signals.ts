import { AI_AGENTS, blockedAgents, isAllowed } from "@/lib/robots";
import { findByType, hasType } from "./extract";
import type { JsonLdNode, Signal, SignalOutcome } from "./types";

function outcome(
  points: number,
  status: SignalOutcome["status"],
  detail: string,
  evidence?: Record<string, unknown>,
): SignalOutcome {
  return { points: Math.round(points * 100) / 100, status, detail, evidence };
}

function firstOffer(nodes: JsonLdNode[]): JsonLdNode | null {
  const offers = nodes.filter((node) => hasType(node, "Offer") || hasType(node, "AggregateOffer"));
  return offers[0] ?? null;
}

const CHALLENGE_MARKERS = [
  "cf-mitigated",
  "just a moment",
  "attention required",
  "enable javascript and cookies",
  "px-captcha",
  "incapsula incident",
  "access denied",
  "request unsuccessful",
  "verify you are human",
];

function looksChallenged(body: string, headers: Record<string, string>, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  if (headers["cf-mitigated"]) return true;
  const haystack = body.slice(0, 20_000).toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => haystack.includes(marker));
}

export const SIGNALS: Signal[] = [
  // ---------------------------------------------------------------- access 25
  {
    id: "robots_ai_crawlers",
    dimension: "access",
    title: "robots.txt allows AI crawlers",
    max: 10,
    why: "If GPTBot, ClaudeBot or PerplexityBot are disallowed, agents cannot read your catalogue at all.",
    fix: "Allow the shopping-relevant AI user agents on your public catalogue paths in robots.txt.",
    evaluate: (context) => {
      if (!context.robots.found) {
        return outcome(8, "partial", "No robots.txt found — nothing is blocked, but crawl guidance is missing.", {
          status: context.robots.status,
        });
      }
      const blocked = blockedAgents(context.robots, "/");
      const ratio = blocked.length / AI_AGENTS.length;
      if (blocked.length === 0) return outcome(10, "pass", "All checked AI crawlers are allowed on /.");
      return outcome(
        Math.max(0, 10 * (1 - ratio) - 2),
        blocked.length >= AI_AGENTS.length / 2 ? "fail" : "partial",
        `Blocked on /: ${blocked.join(", ")}.`,
        { blocked },
      );
    },
  },
  {
    id: "robots_product_paths",
    dimension: "access",
    title: "Product paths are crawlable",
    max: 5,
    why: "Many sites allow the homepage but disallow /products or /cart-adjacent paths agents need to read prices.",
    fix: "Remove disallow rules covering product detail and category paths.",
    evaluate: (context) => {
      const path = context.product ? new URL(context.product.url).pathname : "/products/";
      const blocked = AI_AGENTS.filter((agent) => !isAllowed(context.robots, agent, path));
      if (blocked.length === 0) return outcome(5, "pass", `Product path ${path} is crawlable by all checked agents.`);
      return outcome(0, "fail", `Product path ${path} is disallowed for ${blocked.join(", ")}.`, { path, blocked });
    },
  },
  {
    id: "bot_ua_response",
    dimension: "access",
    title: "Serves content to a non-browser user agent",
    max: 6,
    why: "Bot management often returns a challenge page to anything without a browser fingerprint.",
    fix: "Allowlist declared AI agents in your WAF/bot manager instead of serving them an interstitial.",
    evaluate: (context) => {
      const bot = context.botHome;
      if (bot.error) return outcome(0, "fail", `Request as AgentCommerceBot failed: ${bot.error}.`);
      if (looksChallenged(bot.body, bot.headers, bot.status)) {
        return outcome(0, "fail", `Bot-managed response (HTTP ${bot.status}) to a declared crawler.`, {
          status: bot.status,
          server: bot.headers["server"] ?? null,
        });
      }
      if (bot.status >= 400) return outcome(1, "fail", `HTTP ${bot.status} for the bot user agent.`);
      const browserLength = context.browserHome.body.length || 1;
      const parity = bot.body.length / browserLength;
      if (parity < 0.5) {
        return outcome(3, "partial", `Bot receives ${Math.round(parity * 100)}% of the HTML a browser receives.`, {
          parity,
        });
      }
      return outcome(6, "pass", "Same content is served to a declared crawler and to a browser.");
    },
  },
  {
    id: "server_rendered",
    dimension: "access",
    title: "Content is server-rendered",
    max: 4,
    why: "Agents that fetch HTML without executing JavaScript see nothing on a client-rendered storefront.",
    fix: "Server-render product name, price and availability, or expose them in JSON-LD.",
    evaluate: (context) => {
      const page = context.product ?? context.home;
      if (!page) return outcome(0, "unknown", "No page could be fetched.");
      if (page.textLength >= 1500) return outcome(4, "pass", `${page.textLength} characters of text in raw HTML.`);
      if (page.textLength >= 400)
        return outcome(2, "partial", `Only ${page.textLength} characters of text in raw HTML.`);
      return outcome(0, "fail", `Raw HTML is effectively empty (${page.textLength} characters of text).`);
    },
  },
  // ------------------------------------------------------------------ data 25
  {
    id: "jsonld_product",
    dimension: "data",
    title: "Valid Product structured data",
    max: 8,
    why: "Product JSON-LD is how agents identify what is being sold without guessing from markup.",
    fix: "Emit schema.org Product JSON-LD with name, image, description and sku on every product page.",
    evaluate: (context) => {
      if (!context.product) return outcome(0, "unknown", "No product page could be discovered from the homepage.");
      const products = findByType(context.product.jsonLd, "Product");
      if (products.length === 0)
        return outcome(0, "fail", "No schema.org Product node on the discovered product page.", {
          url: context.product.url,
        });
      const required = ["name", "image", "description"];
      const present = products
        .map((node) => required.filter((field) => Boolean(node[field])))
        .reduce<string[]>((best, fields) => (fields.length > best.length ? fields : best), []);
      return outcome(
        3 + (5 * present.length) / required.length,
        present.length === required.length ? "pass" : "partial",
        `Product node found with ${present.join(", ") || "no core fields"}.`,
        { url: context.product.url, fields: present },
      );
    },
  },
  {
    id: "jsonld_offer",
    dimension: "data",
    title: "Offer with price, currency and availability",
    max: 7,
    why: "Without a machine-readable price and availability an agent cannot compare or commit to a purchase.",
    fix: "Add an Offer with price, priceCurrency and availability to your Product JSON-LD.",
    evaluate: (context) => {
      if (!context.product) return outcome(0, "unknown", "No product page could be discovered.");
      const offer = firstOffer(context.product.jsonLd);
      if (!offer) return outcome(0, "fail", "No Offer node on the product page.");
      const fields = ["price", "priceCurrency", "availability"].filter(
        (field) => Boolean(offer[field]) || Boolean(offer[`low${field[0].toUpperCase()}${field.slice(1)}`]),
      );
      return outcome(
        (7 * fields.length) / 3,
        fields.length === 3 ? "pass" : "partial",
        `Offer exposes ${fields.join(", ") || "none of price, currency, availability"}.`,
        { fields },
      );
    },
  },
  {
    id: "stable_identifiers",
    dimension: "data",
    title: "Stable product identifiers",
    max: 3,
    why: "GTIN/MPN/SKU lets an agent match your product to the one the user actually asked for.",
    fix: "Publish gtin13, mpn or sku in your Product JSON-LD.",
    evaluate: (context) => {
      if (!context.product) return outcome(0, "unknown", "No product page could be discovered.");
      const products = findByType(context.product.jsonLd, "Product");
      const keys = ["gtin13", "gtin", "gtin12", "gtin14", "mpn", "sku", "productID"];
      const found = products.flatMap((node) => keys.filter((key) => Boolean(node[key])));
      if (found.length === 0) return outcome(0, "fail", "No GTIN, MPN or SKU published.");
      return outcome(found.some((key) => key.startsWith("gtin")) ? 3 : 2, "partial", `Identifiers: ${[...new Set(found)].join(", ")}.`, {
        identifiers: [...new Set(found)],
      });
    },
  },
  {
    id: "category_itemlist",
    dimension: "data",
    title: "Category pages expose an ItemList",
    max: 3,
    why: "Agents browse categories to build a shortlist; an ItemList removes the need to scrape cards.",
    fix: "Add ItemList JSON-LD with product URLs to category and search pages.",
    evaluate: (context) => {
      if (!context.category) return outcome(0, "unknown", "No category page could be discovered.");
      const lists = findByType(context.category.jsonLd, "ItemList");
      if (lists.length === 0) return outcome(0, "fail", "No ItemList on the discovered category page.");
      return outcome(3, "pass", "Category page exposes an ItemList.", { url: context.category.url });
    },
  },
  {
    id: "product_feed",
    dimension: "data",
    title: "Machine-readable product feed",
    max: 4,
    why: "A feed is the cheapest way for an agent platform to ingest your whole catalogue.",
    fix: "Publish a products.json / Google Merchant feed and link it from robots.txt or /.well-known.",
    evaluate: (context) => {
      const feed = context.feeds.find((candidate) => candidate.status === 200);
      if (!feed) return outcome(0, "fail", "No product feed found at the conventional locations.");
      return outcome(4, "pass", `Feed available at ${new URL(feed.url).pathname}.`, { url: feed.url });
    },
  },
  // ------------------------------------------------------------- protocols 20
  {
    id: "acp_signals",
    dimension: "protocols",
    title: "Agentic Commerce Protocol support",
    max: 7,
    why: "ACP is what lets ChatGPT complete a checkout against your store instead of linking out.",
    fix: "Expose an ACP feed/checkout endpoint or enable your platform's agentic-checkout integration.",
    evaluate: (context) => {
      const hits = Object.entries(context.wellKnown).filter(
        ([path, result]) => result.status === 200 && /acp|agentic|checkout/.test(path),
      );
      const inline = /agentic[- ]?commerce|agentic checkout|shared payment token/i.test(
        context.home?.outcome.body.slice(0, 200_000) ?? "",
      );
      if (hits.length > 0) return outcome(7, "pass", `ACP endpoint responding: ${hits.map(([p]) => p).join(", ")}.`);
      if (inline) return outcome(3, "partial", "Page markup mentions agentic commerce but no endpoint responded.");
      return outcome(0, "fail", "No ACP or agentic-checkout endpoint detected.");
    },
  },
  {
    id: "llms_txt",
    dimension: "protocols",
    title: "llms.txt guidance file",
    max: 5,
    why: "llms.txt is the emerging convention for telling an agent where the useful, canonical content is.",
    fix: "Publish /llms.txt listing catalogue entry points, feeds, policies and contact.",
    evaluate: (context) => {
      const full = context.wellKnown["/llms-full.txt"];
      const basic = context.wellKnown["/llms.txt"];
      if (basic?.status === 200 && full?.status === 200)
        return outcome(5, "pass", "Both llms.txt and llms-full.txt are published.");
      if (basic?.status === 200) return outcome(4, "pass", "llms.txt is published.");
      return outcome(0, "fail", "No llms.txt found.");
    },
  },
  {
    id: "mcp_discovery",
    dimension: "protocols",
    title: "MCP or A2A discovery document",
    max: 5,
    why: "A discoverable MCP server or agent card lets agents call your commerce functions directly.",
    fix: "Publish /.well-known/mcp.json or /.well-known/agent.json describing your endpoints.",
    evaluate: (context) => {
      const found = Object.entries(context.wellKnown).filter(
        ([path, result]) => result.status === 200 && /mcp|agent(-card)?\.json|a2a/.test(path),
      );
      if (found.length === 0) return outcome(0, "fail", "No MCP or A2A discovery document found.");
      return outcome(5, "pass", `Discovery document at ${found.map(([path]) => path).join(", ")}.`);
    },
  },
  {
    id: "x402_ap2",
    dimension: "protocols",
    title: "Machine-payable endpoint signals (x402 / AP2)",
    max: 3,
    why: "x402 and AP2 are how an agent can pay without a human-driven card form.",
    fix: "If you sell digital access, return 402 with x402 headers; otherwise adopt AP2 mandates via your PSP.",
    evaluate: (context) => {
      const hit = Object.entries(context.wellKnown).find(
        ([path, result]) => /x402|ap2|payment/.test(path) && result.status === 200,
      );
      const header = Object.values(context.wellKnown).some((result) =>
        Object.keys(result.headers).some((key) => key.includes("x402") || key.includes("payment-required")),
      );
      if (hit || header) return outcome(3, "pass", "x402/AP2 signal detected.");
      return outcome(0, "fail", "No x402 or AP2 signals detected.");
    },
  },
  // -------------------------------------------------------------- checkout 15
  {
    id: "cart_reachable",
    dimension: "checkout",
    title: "Cart or checkout entry point is reachable",
    max: 5,
    why: "Agents need a linkable, crawlable cart URL to hand a basket back to the user.",
    fix: "Expose a stable /cart URL that renders without JavaScript and is not disallowed in robots.txt.",
    evaluate: (context) => {
      if (!context.checkout) return outcome(0, "fail", "No cart or checkout URL discovered from the homepage.");
      const status = context.checkout.outcome.status;
      if (status >= 400) return outcome(1, "fail", `Cart URL returns HTTP ${status}.`, { url: context.checkout.url });
      return outcome(5, "pass", `Cart reachable at ${new URL(context.checkout.url).pathname}.`, {
        url: context.checkout.url,
      });
    },
  },
  {
    id: "guest_checkout",
    dimension: "checkout",
    title: "No forced login before checkout",
    max: 6,
    why: "A mandatory account or OTP is where most agent purchases die.",
    fix: "Offer guest checkout and defer account creation until after the order.",
    evaluate: (context) => {
      const page = context.checkout;
      if (!page) return outcome(0, "unknown", "Cart page not available, cannot assess structurally.");
      const haystack = page.outcome.body.slice(0, 200_000).toLowerCase();
      const guest = /guest checkout|as a guest|ohne konto|ohne registrierung|weiter als gast/.test(haystack);
      const forced = /you must (log|sign) in|login required|anmeldung erforderlich/.test(haystack);
      const login = page.forms.some((form) =>
        form.inputs.some((input) => input.type === "password" || input.autocomplete === "current-password"),
      );
      if (forced) return outcome(0, "fail", "Cart page states that login is required.");
      if (guest) return outcome(6, "pass", "Guest checkout is offered.");
      if (login) return outcome(2, "partial", "Cart page presents a login form and no guest-checkout wording.");
      return outcome(4, "partial", "No login wall detected, but guest checkout is not stated explicitly.");
    },
  },
  {
    id: "form_semantics",
    dimension: "checkout",
    title: "Checkout forms are semantically labelled",
    max: 4,
    why: "autocomplete tokens and input names are what let an agent fill an address without guessing.",
    fix: "Add standard autocomplete attributes (given-name, postal-code, email …) to checkout inputs.",
    evaluate: (context) => {
      const page = context.checkout ?? context.home;
      if (!page) return outcome(0, "unknown", "No page available.");
      const inputs = page.forms.flatMap((form) => form.inputs).filter((input) => input.type !== "hidden");
      if (inputs.length === 0) return outcome(0, "unknown", "No form fields rendered server-side to assess.");
      const labelled = inputs.filter((input) => input.autocomplete && input.autocomplete !== "off");
      const share = labelled.length / inputs.length;
      if (share >= 0.6) return outcome(4, "pass", `${labelled.length}/${inputs.length} fields carry autocomplete.`);
      if (share > 0) return outcome(2, "partial", `Only ${labelled.length}/${inputs.length} fields carry autocomplete.`);
      return outcome(0, "fail", "No autocomplete attributes on rendered form fields.");
    },
  },
  // ----------------------------------------------------------- performance 10
  {
    id: "ttfb",
    dimension: "performance",
    title: "Time to first byte",
    max: 4,
    why: "Agent orchestrators time out aggressively; slow origins get dropped from consideration.",
    fix: "Cache HTML at the edge for anonymous requests, including declared crawlers.",
    evaluate: (context) => {
      const ttfb = context.botHome.ttfbMs;
      if (!ttfb) return outcome(0, "unknown", "No timing captured.");
      if (ttfb <= 800) return outcome(4, "pass", `TTFB ${ttfb} ms.`, { ttfb });
      if (ttfb <= 2000) return outcome(2, "partial", `TTFB ${ttfb} ms.`, { ttfb });
      return outcome(0, "fail", `TTFB ${ttfb} ms.`, { ttfb });
    },
  },
  {
    id: "page_weight",
    dimension: "performance",
    title: "HTML payload size",
    max: 2,
    why: "Multi-megabyte HTML blows up agent context windows and parsing cost.",
    fix: "Trim inline state blobs and duplicated markup from server-rendered HTML.",
    evaluate: (context) => {
      const bytes = context.botHome.bytes;
      if (!bytes) return outcome(0, "unknown", "No payload captured.");
      const kb = Math.round(bytes / 1024);
      if (kb <= 500) return outcome(2, "pass", `Homepage HTML ${kb} KB.`, { kb });
      if (kb <= 1200) return outcome(1, "partial", `Homepage HTML ${kb} KB.`, { kb });
      return outcome(0, "fail", `Homepage HTML ${kb} KB.`, { kb });
    },
  },
  {
    id: "sitemap",
    dimension: "performance",
    title: "Sitemap is discoverable and structured",
    max: 4,
    why: "A sitemap is the fastest way for an agent platform to enumerate your catalogue.",
    fix: "Reference an XML sitemap index from robots.txt and keep each file under 50k URLs.",
    evaluate: (context) => {
      const ok = context.sitemaps.filter((sitemap) => sitemap.status === 200);
      if (ok.length === 0) return outcome(0, "fail", "No sitemap found at /sitemap.xml or in robots.txt.");
      const declared = context.robots.sitemaps.length > 0;
      const total = ok.reduce((sum, sitemap) => sum + sitemap.urlCount, 0);
      return outcome(
        declared ? 4 : 2.5,
        declared ? "pass" : "partial",
        `${ok.length} sitemap file(s), ${total} URLs listed${declared ? ", declared in robots.txt" : ", not declared in robots.txt"}.`,
        { sitemaps: ok },
      );
    },
  },
  // ---------------------------------------------------------------- policy 5
  {
    id: "ai_policy",
    dimension: "policy",
    title: "Stated automated-access policy",
    max: 3,
    why: "Agent platforms need an explicit permission signal before transacting on a user's behalf.",
    fix: "Publish an AI/automated-access policy page and reference it from llms.txt and robots.txt.",
    evaluate: (context) => {
      const links = context.home?.links ?? [];
      const policy = links.find((link) => /ai-policy|automated-access|bot-policy|ai-usage|robots-policy/i.test(link));
      if (policy) return outcome(3, "pass", "Automated-access policy page linked from the homepage.", { policy });
      if (context.robots.raw.toLowerCase().includes("policy"))
        return outcome(1.5, "partial", "robots.txt references a policy but no policy page is linked.");
      return outcome(0, "fail", "No automated-access or AI policy found.");
    },
  },
  {
    id: "machine_contact",
    dimension: "policy",
    title: "Machine-readable contact / API surface",
    max: 2,
    why: "Agents and their operators need a programmatic way to resolve problems and request access.",
    fix: "Publish /.well-known/security.txt and an openapi.json or documented API endpoint.",
    evaluate: (context) => {
      const found = Object.entries(context.wellKnown).filter(
        ([path, result]) => result.status === 200 && /security\.txt|openapi|api-docs/.test(path),
      );
      if (found.length === 0) return outcome(0, "fail", "No security.txt or API description found.");
      return outcome(2, "pass", `Found ${found.map(([path]) => path).join(", ")}.`);
    },
  },
];

export const SIGNALS_BY_DIMENSION = SIGNALS.reduce<Record<string, Signal[]>>((accumulator, signal) => {
  (accumulator[signal.dimension] ??= []).push(signal);
  return accumulator;
}, {});
