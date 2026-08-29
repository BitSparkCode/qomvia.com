import { describe, expect, it } from "vitest";
import { aggregateRun, analyzeAnswer, registrableHost } from "@/lib/visibility/analyze";
import { generatePrompts, localesForCountry, topCategories } from "@/lib/visibility/prompts";
import { extractUrls } from "@/lib/visibility/providers";
import { SAMPLE_PLAN, VISIBILITY_PLANS, creditsForRun } from "@/lib/visibility/plans";

const brand = { name: "Transa", domain: "transa.ch" };

describe("registrableHost", () => {
  it("normalises hosts and rejects non-urls", () => {
    expect(registrableHost("https://www.digitec.ch/de/product/1")).toBe("digitec.ch");
    expect(registrableHost("https://shop.example.co.uk/x")).toBe("shop.example.co.uk");
    expect(registrableHost("not a url")).toBeNull();
  });
});

describe("analyzeAnswer", () => {
  it("detects a mention by brand name and a citation by domain", () => {
    const analysis = analyzeAnswer(
      "For hiking gear in Switzerland, Transa is the best-known specialist, followed by Bächli.",
      ["https://www.transa.ch/de/", "https://baechli-bergsport.ch/"],
      brand,
    );
    expect(analysis.mentioned).toBe(true);
    expect(analysis.cited).toBe(true);
    expect(analysis.rank).toBe(1);
  });

  it("reports no mention when the brand is absent and collects competitors", () => {
    const analysis = analyzeAnswer(
      "Try digitec.ch or galaxus.ch for that camera.",
      ["https://www.digitec.ch/x"],
      brand,
    );
    expect(analysis.mentioned).toBe(false);
    expect(analysis.cited).toBe(false);
    expect(analysis.rank).toBeNull();
    expect(analysis.competitors).toContain("digitec.ch");
  });

  it("does not count the brand as its own competitor", () => {
    const analysis = analyzeAnswer("transa.ch has it in stock.", ["https://transa.ch/p"], brand);
    expect(analysis.competitors).not.toContain("transa.ch");
  });
});

describe("aggregateRun", () => {
  it("scores an invisible brand at zero and a cited brand highly", () => {
    const invisible = aggregateRun([
      { mentioned: false, cited: false, rank: null, competitors: ["digitec.ch"] },
      { mentioned: false, cited: false, rank: null, competitors: ["galaxus.ch"] },
    ]);
    expect(invisible.score).toBe(0);
    expect(invisible.mentionRate).toBe(0);

    const strong = aggregateRun([
      { mentioned: true, cited: true, rank: 1, competitors: [] },
      { mentioned: true, cited: true, rank: 2, competitors: [] },
    ]);
    expect(strong.score).toBeGreaterThan(80);
    expect(strong.mentionRate).toBe(1);
    expect(strong.avgRank).toBe(1.5);
  });

  it("returns an empty aggregate without results", () => {
    const empty = aggregateRun([]);
    expect(empty.score).toBe(0);
    expect(empty.avgRank).toBeNull();
    expect(empty.shareOfVoice).toEqual([]);
  });

  it("shares voice across the competitors that appear", () => {
    const aggregate = aggregateRun([
      { mentioned: false, cited: false, rank: null, competitors: ["digitec.ch", "galaxus.ch"] },
      { mentioned: false, cited: false, rank: null, competitors: ["digitec.ch"] },
    ]);
    expect(aggregate.shareOfVoice[0]).toMatchObject({ host: "digitec.ch", answers: 2 });
    expect(aggregate.shareOfVoice[0].share).toBeCloseTo(1);
  });
});

describe("prompt generation", () => {
  const products = [
    { externalId: "1", title: "Merino Runner", category: "Shoes", priceCents: 18900 },
    { externalId: "2", title: "Trail Cap", category: "Caps", priceCents: 3900 },
    { externalId: "3", title: "Wool Jacket", category: "Shoes", priceCents: 44900 },
  ];

  it("ranks categories by catalogue weight", () => {
    expect(topCategories(products, 1)).toEqual(["shoes"]);
  });

  it("stays inside the prompt budget and never repeats a phrase", () => {
    const prompts = generatePrompts(
      { brandName: "Testbrand", domain: "test.ch", locales: ["de-CH"], products },
      7,
    );
    expect(prompts.length).toBeLessThanOrEqual(7);
    expect(new Set(prompts.map((prompt) => prompt.text)).size).toBe(prompts.length);
    expect(prompts.every((prompt) => prompt.text.trim().length > 0)).toBe(true);
  });

  it("produces nothing for an empty budget", () => {
    expect(generatePrompts({ brandName: "T", domain: "t.ch", locales: ["de-CH"], products }, 0)).toEqual([]);
  });
});

describe("provider helpers", () => {
  it("collects urls from arbitrarily nested provider payloads", () => {
    const urls = extractUrls({
      a: "see https://example.com/x",
      b: [{ url: "https://second.test/y" }, { nested: { href: "https://third.test/z" } }],
    });
    expect(urls).toContain("https://example.com/x");
    expect(urls).toContain("https://second.test/y");
    expect(urls).toContain("https://third.test/z");
  });
});

describe("plans", () => {
  it("keeps provider spend bounded per tier", () => {
    expect(VISIBILITY_PLANS.MONITOR.promptBudget).toBeLessThan(VISIBILITY_PLANS.AGENCY.promptBudget);
    expect(VISIBILITY_PLANS.MONITOR.refreshDays).toBeGreaterThanOrEqual(VISIBILITY_PLANS.AGENCY.refreshDays);
    expect(SAMPLE_PLAN.providers.length).toBeGreaterThan(0);
    expect(SAMPLE_PLAN.monthlyCredits).toBe(0);
  });

  it("charges one credit per phrase per provider", () => {
    expect(creditsForRun(10, ["openai", "perplexity"])).toBe(20);
  });
});

describe("locales", () => {
  const products = [
    { externalId: "1", title: "Merino Runner", category: "Shoes", priceCents: 18900 },
    { externalId: "2", title: "Trail Cap", category: "Caps", priceCents: 3900 },
    { externalId: "3", title: "Wool Jacket", category: "Shoes", priceCents: 44900 },
  ];

  it("asks the home market first and bounds the list by the plan", () => {
    expect(localesForCountry("CH", 3)).toEqual(["de-CH", "en-CH", "fr-CH"]);
    expect(localesForCountry("DE", 1)).toEqual(["de-DE"]);
    expect(localesForCountry(null, 1)).toEqual(["de-CH"]);
  });

  it("varies the phrase text per locale", () => {
    const prompts = generatePrompts(
      { brandName: "Testbrand", domain: "test.ch", locales: ["de-CH", "fr-CH"], products },
      60,
    );
    expect(new Set(prompts.map((prompt) => prompt.locale))).toEqual(new Set(["de-CH", "fr-CH"]));
    expect(new Set(prompts.map((prompt) => `${prompt.locale}|${prompt.text}`)).size).toBe(prompts.length);
  });

  it("covers every product with a buying phrase when the budget allows", () => {
    const prompts = generatePrompts(
      { brandName: "Testbrand", domain: "test.ch", locales: ["de-CH"], products },
      500,
    );
    const covered = new Set(prompts.filter((prompt) => prompt.externalId).map((prompt) => prompt.externalId));
    expect(covered.size).toBe(products.length);
  });
});
