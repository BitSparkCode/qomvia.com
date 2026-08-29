import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = ["src/lib/rubric/crawl.ts", "src/lib/rubric/signals.ts", "src/lib/http.ts"];
const SOURCES = FILES.map((file) => ({ file, source: readFileSync(join(process.cwd(), file), "utf8") }));

/**
 * The published methodology promises a read-only crawler. These checks fail the
 * build if a mutating request, browser automation or challenge solving is ever
 * introduced into the crawl path.
 */
describe("crawler safety guarantees", () => {
  it("declares no non-idempotent HTTP method", () => {
    for (const { file, source } of SOURCES) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(new RegExp(`["']${method}["']`).test(source), `${file} must not use ${method}`).toBe(false);
      }
    }
  });

  it("restricts the fetch helper to GET and HEAD", () => {
    const http = SOURCES.find((entry) => entry.file === "src/lib/http.ts")!.source;
    expect(http).toContain('method?: "GET" | "HEAD"');
  });

  it("never sets a request body and never submits a form", () => {
    for (const { file, source } of SOURCES) {
      const fetchCalls = source.match(/fetch\([\s\S]*?\n\s*\}\)/g) ?? [];
      for (const call of fetchCalls) {
        expect(/\bbody\s*:/.test(call), `${file} must not send a request body`).toBe(false);
      }
      expect(/\.submit\(/.test(source), `${file} must not submit forms`).toBe(false);
    }
  });

  it("does not depend on browser automation or captcha solving", () => {
    for (const { file, source } of SOURCES) {
      for (const term of ["puppeteer", "playwright", "captcha-solver", "2captcha", "anticaptcha"]) {
        expect(source.toLowerCase().includes(term), `${file} must not use ${term}`).toBe(false);
      }
    }
  });

  it("constrains the crawl budget", () => {
    const http = SOURCES.find((entry) => entry.file === "src/lib/http.ts")!.source;
    for (const guard of ["MAX_BYTES", "TIMEOUT_MS", "MIN_DELAY_MS", "assertPublicHost"]) {
      expect(http).toContain(guard);
    }
  });
});
