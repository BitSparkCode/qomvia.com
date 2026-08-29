import { BOT_UA, BROWSER_UA, safeFetch, type FetchOutcome } from "@/lib/http";
import { isAllowed, parseRobots } from "@/lib/robots";
import {
  countSitemapUrls,
  guessCategoryUrl,
  guessCheckoutUrl,
  guessProductUrl,
  snapshot,
} from "./extract";
import { SIGNALS } from "./signals";
import { DIMENSIONS, grade, RUBRIC_VERSION, type CrawlContext, type DimensionId, type ScanResult } from "./types";

const WELL_KNOWN_PATHS = [
  "/llms.txt",
  "/llms-full.txt",
  "/.well-known/mcp.json",
  "/.well-known/agent.json",
  "/.well-known/agent-card.json",
  "/.well-known/agentic-commerce.json",
  "/.well-known/acp.json",
  "/.well-known/x402.json",
  "/.well-known/security.txt",
  "/openapi.json",
];

const FEED_PATHS = ["/products.json", "/feed/products.json", "/product-feed.xml", "/googlebase.xml", "/feeds/products.xml"];

/**
 * Collects evidence with GET requests only. The crawler never submits a form,
 * never attempts a purchase and never tries to defeat a bot challenge; a
 * challenge response is simply recorded as a finding.
 */
export async function collect(domain: string, mode: "SHALLOW" | "DEEP" = "SHALLOW"): Promise<CrawlContext> {
  let urlsFetched = 0;
  const notes: string[] = [];

  let botHome = await safeFetch(`https://${domain}`, { ua: BOT_UA });
  urlsFetched += 1;
  if (botHome.error || botHome.status >= 400) {
    const wwwHome = await safeFetch(`https://www.${domain}`, { ua: BOT_UA });
    urlsFetched += 1;
    if (!wwwHome.error && wwwHome.status < 400) botHome = wwwHome;
  }
  const origin = new URL(botHome.finalUrl || `https://${domain}`).origin;

  const [robotsOutcome, browserHome] = await Promise.all([
    safeFetch(`${origin}/robots.txt`, { accept: "text/plain,*/*" }),
    safeFetch(origin, { ua: BROWSER_UA }),
  ]);
  urlsFetched += 2;
  const robots = parseRobots(robotsOutcome.body, robotsOutcome.status, robotsOutcome.status === 200);

  const home = botHome.body ? snapshot(botHome) : browserHome.body ? snapshot(browserHome) : null;
  if (!home) notes.push("Homepage returned no HTML to either user agent.");

  const links = home?.links ?? [];
  const productUrl = guessProductUrl(links, origin);
  const categoryUrl = guessCategoryUrl(links, origin);
  const checkoutUrl = guessCheckoutUrl(links, origin);

  const fetchIfAllowed = async (url: string | null) => {
    if (!url) return null;
    const path = new URL(url).pathname;
    if (!isAllowed(robots, "QomviaBot", path)) {
      notes.push(`Skipped ${path}: disallowed for our crawler in robots.txt.`);
      return null;
    }
    const result = await safeFetch(url, { ua: BOT_UA });
    urlsFetched += 1;
    return result.body || result.status ? snapshot(result) : null;
  };

  const category = await fetchIfAllowed(categoryUrl);
  const productFromCategory = category ? guessProductUrl(category.links, origin) : null;
  const product = await fetchIfAllowed(productUrl ?? productFromCategory);
  const checkout = (await fetchIfAllowed(checkoutUrl)) ?? (await fetchIfAllowed(`${origin}/cart`));

  const wellKnown: Record<string, FetchOutcome> = {};
  for (const path of WELL_KNOWN_PATHS) {
    wellKnown[path] = await safeFetch(`${origin}${path}`, { accept: "*/*" });
    urlsFetched += 1;
  }

  const feeds: CrawlContext["feeds"] = [];
  for (const path of FEED_PATHS) {
    const result = await safeFetch(`${origin}${path}`, { accept: "*/*" });
    urlsFetched += 1;
    feeds.push({ url: result.url, status: result.status, contentType: result.headers["content-type"] ?? "" });
    if (result.status === 200 && mode === "SHALLOW") break;
  }

  const sitemapCandidates = [...new Set([...robots.sitemaps, `${origin}/sitemap.xml`])].slice(0, mode === "DEEP" ? 6 : 2);
  const sitemaps: CrawlContext["sitemaps"] = [];
  for (const candidate of sitemapCandidates) {
    const result = await safeFetch(candidate, { accept: "application/xml,text/xml,*/*" });
    urlsFetched += 1;
    const parsed = countSitemapUrls(result.body);
    sitemaps.push({ url: candidate, status: result.status, urlCount: parsed.urlCount, isIndex: parsed.isIndex });
  }

  return {
    domain,
    origin,
    robots,
    botHome,
    browserHome,
    home,
    category,
    product,
    checkout,
    wellKnown,
    sitemaps,
    feeds,
    urlsFetched,
    notes,
  };
}

export function score(context: CrawlContext): ScanResult {
  const signals = SIGNALS.map((signal) => {
    const result = signal.evaluate(context);
    const points = Math.max(0, Math.min(signal.max, result.points));
    return { ...result, points, id: signal.id, dimension: signal.dimension, title: signal.title, max: signal.max };
  });

  const dimensions = (Object.keys(DIMENSIONS) as DimensionId[]).map((id) => {
    const own = signals.filter((signal) => signal.dimension === id);
    return {
      id,
      label: DIMENSIONS[id].label,
      points: Math.round(own.reduce((sum, signal) => sum + signal.points, 0) * 10) / 10,
      max: DIMENSIONS[id].max,
    };
  });

  const total = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.points, 0));
  return {
    score: total,
    grade: grade(total),
    dimensions,
    signals,
    rubricVersion: RUBRIC_VERSION,
    urlsFetched: context.urlsFetched,
  };
}

export async function runScan(domain: string, mode: "SHALLOW" | "DEEP" = "SHALLOW") {
  const started = Date.now();
  const context = await collect(domain, mode);
  const result = score(context);
  return { ...result, durationMs: Date.now() - started, context };
}
