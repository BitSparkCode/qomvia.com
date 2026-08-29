import { describe, expect, it, vi } from "vitest";
import { BOT_UA, normalizeDomain, safeFetch } from "@/lib/http";

describe("normalizeDomain", () => {
  it("strips scheme, path, www and casing", () => {
    expect(normalizeDomain("HTTPS://WWW.Example.com/products?a=1")).toBe("example.com");
    expect(normalizeDomain(" example.com ")).toBe("example.com");
    expect(normalizeDomain("shop.example.co.uk")).toBe("shop.example.co.uk");
  });

  it("rejects unparseable input", () => {
    expect(() => normalizeDomain("not a domain")).toThrow();
  });
});

describe("safeFetch", () => {
  it("refuses non-http protocols without issuing a request", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await safeFetch("file:///etc/passwd");
    expect(result.error).toBe("unsupported protocol");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("refuses loopback and internal hosts (SSRF guard)", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const url of ["http://localhost:3000/", "http://127.0.0.1/", "http://foo.internal/"]) {
      const result = await safeFetch(url);
      expect(result.error, url).toBe("Refusing to scan a non-public host");
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("only ever issues GET or HEAD, and identifies the crawler honestly", async () => {
    const calls: RequestInit[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      calls.push(init ?? {});
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    });

    await safeFetch("https://example.com/");
    await safeFetch("https://example.com/robots.txt", { method: "HEAD" });

    expect(calls.map((call) => call.method)).toEqual(["GET", "HEAD"]);
    for (const call of calls) {
      expect(call.body).toBeUndefined();
      const headers = call.headers as Record<string, string>;
      expect(headers["user-agent"]).toContain("AgentCommerceBot");
    }
    expect(BOT_UA).toContain("respects robots.txt");
    spy.mockRestore();
  });
});
