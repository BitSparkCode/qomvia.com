import { describe, expect, it } from "vitest";
import { AI_AGENTS, blockedAgents, isAllowed, parseRobots } from "@/lib/robots";

const ROBOTS = `
User-agent: *
Disallow: /admin
Allow: /admin/public

User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Crawl-delay: 10
Disallow: /checkout

Sitemap: https://example.com/sitemap.xml
`;

describe("parseRobots", () => {
  const robots = parseRobots(ROBOTS, 200, true);

  it("collects groups and sitemaps", () => {
    expect(robots.found).toBe(true);
    expect(robots.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
    expect(robots.groups.length).toBe(3);
  });

  it("applies the longest matching rule with allow winning ties", () => {
    expect(isAllowed(robots, "SomeBot", "/admin")).toBe(false);
    expect(isAllowed(robots, "SomeBot", "/admin/public/page")).toBe(true);
    expect(isAllowed(robots, "SomeBot", "/products/shoe")).toBe(true);
  });

  it("prefers an agent-specific group over the wildcard group", () => {
    expect(isAllowed(robots, "GPTBot", "/products/shoe")).toBe(false);
    expect(isAllowed(robots, "PerplexityBot", "/products/shoe")).toBe(true);
    expect(isAllowed(robots, "PerplexityBot", "/checkout")).toBe(false);
  });

  it("reports which AI agents are blocked", () => {
    expect(blockedAgents(robots)).toContain("GPTBot");
    expect(blockedAgents(robots)).not.toContain("PerplexityBot");
  });

  it("treats a missing robots.txt as fully allowed", () => {
    const missing = parseRobots("", 404, false);
    expect(isAllowed(missing, "GPTBot", "/anything")).toBe(true);
    expect(blockedAgents(missing)).toEqual([]);
  });

  it("handles wildcard and end-anchored patterns", () => {
    const wildcard = parseRobots("User-agent: *\nDisallow: /*.json$\nDisallow: /a/*/b\n", 200, true);
    expect(isAllowed(wildcard, "Any", "/products.json")).toBe(false);
    expect(isAllowed(wildcard, "Any", "/products.json?x=1")).toBe(true);
    expect(isAllowed(wildcard, "Any", "/a/x/b")).toBe(false);
  });

  it("tracks the AI agents the rubric reports on", () => {
    expect(AI_AGENTS).toContain("GPTBot");
    expect(AI_AGENTS.length).toBeGreaterThan(5);
  });
});
