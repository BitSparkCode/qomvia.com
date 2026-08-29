import type { FetchOutcome } from "@/lib/http";
import { parseRobots } from "@/lib/robots";
import type { CrawlContext } from "@/lib/rubric/types";

export function outcome(overrides: Partial<FetchOutcome> = {}): FetchOutcome {
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    status: 0,
    ok: false,
    headers: {},
    body: "",
    bytes: 0,
    ttfbMs: 0,
    totalMs: 0,
    redirects: 0,
    ...overrides,
  };
}

/** A context where nothing could be measured: every signal must still evaluate. */
export function emptyContext(): CrawlContext {
  return {
    domain: "example.com",
    origin: "https://example.com",
    robots: parseRobots("", 404, false),
    botHome: outcome(),
    browserHome: outcome(),
    home: null,
    category: null,
    product: null,
    checkout: null,
    wellKnown: {},
    sitemaps: [],
    feeds: [],
    urlsFetched: 0,
    notes: [],
  };
}
