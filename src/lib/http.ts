import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const BOT_UA =
  "QomviaBot/1.0 (+https://qomvia.com/bot; readiness measurement; respects robots.txt)";
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;
const MIN_DELAY_MS = 700;

export type FetchOutcome = {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  ttfbMs: number;
  totalMs: number;
  redirects: number;
  error?: string;
};

const lastRequestAt = new Map<string, number>();

async function throttle(host: string) {
  const previous = lastRequestAt.get(host) ?? 0;
  const wait = previous + MIN_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    );
  }
  const [a, b] = address.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Blocks loopback, link-local and RFC1918 targets so a submitted hostname can
 * never be used to probe infrastructure that is not publicly reachable.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    throw new Error("Refusing to scan a non-public host");
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("Hostname does not resolve");
  for (const record of records) {
    if (isPrivateAddress(record.address)) throw new Error("Refusing to scan a non-public host");
  }
}

/**
 * GET a URL with a byte cap, a hard timeout and per-host throttling. Only ever
 * issues GET/HEAD: the crawler never submits a form or a payment.
 */
export async function safeFetch(
  url: string,
  init: { ua?: string; method?: "GET" | "HEAD"; accept?: string } = {},
): Promise<FetchOutcome> {
  const target = new URL(url);
  const started = Date.now();
  const base: FetchOutcome = {
    url,
    finalUrl: url,
    status: 0,
    ok: false,
    headers: {},
    body: "",
    bytes: 0,
    ttfbMs: 0,
    totalMs: 0,
    redirects: 0,
  };
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ...base, error: "unsupported protocol" };
  }

  try {
    await assertPublicHost(target.hostname);
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }

  await throttle(target.hostname);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      method: init.method ?? "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": init.ua ?? BOT_UA,
        accept: init.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en,de;q=0.8",
      },
    });
    const ttfbMs = Date.now() - started;
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    let body = "";
    let bytes = 0;
    if (init.method !== "HEAD" && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const chunks: string[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        chunks.push(decoder.decode(value, { stream: true }));
        if (bytes >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
      body = chunks.join("");
    }

    return {
      url,
      finalUrl: response.url || url,
      status: response.status,
      ok: response.ok,
      headers,
      body,
      bytes,
      ttfbMs,
      totalMs: Date.now() - started,
      redirects: response.redirected ? 1 : 0,
    };
  } catch (error) {
    return { ...base, totalMs: Date.now() - started, error: (error as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  return url.hostname.replace(/^www\./, "");
}
