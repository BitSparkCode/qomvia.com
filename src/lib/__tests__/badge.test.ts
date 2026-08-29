import { describe, expect, it } from "vitest";
import { embeddableTier, nextTier, sealSvg, sealTier } from "@/lib/badge";

describe("seal tiers", () => {
  it("awards the highest tier reached", () => {
    expect(sealTier(97)?.id).toBe("champion");
    expect(sealTier(90)?.id).toBe("champion");
    expect(sealTier(89)?.id).toBe("ready");
    expect(sealTier(60)?.id).toBe("readable");
    expect(sealTier(41)?.id).toBe("progress");
  });

  it("awards nothing below the lowest tier or without a score", () => {
    expect(sealTier(39)).toBeNull();
    expect(sealTier(null)).toBeNull();
    expect(sealTier(undefined)).toBeNull();
  });

  it("keeps the lowest tier out of the public embed", () => {
    expect(embeddableTier(60)?.id).toBe("readable");
    expect(embeddableTier(59)).toBeNull();
    expect(embeddableTier(45)).toBeNull();
  });

  it("names the tier a shop can reach next", () => {
    expect(nextTier(61)?.id).toBe("ready");
    expect(nextTier(80)?.id).toBe("champion");
    expect(nextTier(95)).toBeNull();
  });
});

describe("seal markup", () => {
  const tier = sealTier(92)!;
  const svg = sealSvg(tier, "allbirds.com", "2026-08-29");

  const printed = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]).join(" ");

  it("states the qualification without a score or grade", () => {
    expect(printed).toContain("AI Commerce Champion");
    expect(printed).not.toMatch(/grade/i);
    expect(printed).not.toContain("92");
    expect(printed).not.toContain("100");
  });

  it("carries no anchor, so the markup cannot be repurposed as a link on its own", () => {
    expect(svg).not.toContain("<a ");
  });

  it("escapes the domain it prints", () => {
    expect(sealSvg(tier, 'x"><script>', "2026-08-29")).not.toContain("<script>");
  });
});

describe("badge.js loader", () => {
  it("injects the seal without creating a link", async () => {
    const { GET } = await import("@/app/badge.js/route");
    const source = await GET().text();

    expect(source).toContain('createElement("span")');
    expect(source).not.toContain('createElement("a")');
    expect(source).not.toContain(".href=");
    expect(source).not.toContain(".target=");
  });
});
