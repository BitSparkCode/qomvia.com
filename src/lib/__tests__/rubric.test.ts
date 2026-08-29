import { describe, expect, it } from "vitest";
import { score } from "@/lib/rubric/crawl";
import { SIGNALS } from "@/lib/rubric/signals";
import { DIMENSIONS, grade, type CrawlContext, type DimensionId } from "@/lib/rubric/types";
import { parseRobots } from "@/lib/robots";
import { emptyContext } from "@/lib/__tests__/fixtures";

describe("rubric weights", () => {
  it("sums to 100 across dimensions", () => {
    const total = Object.values(DIMENSIONS).reduce((sum, dimension) => sum + dimension.max, 0);
    expect(total).toBe(100);
  });

  it("has signal maxima matching each dimension budget", () => {
    for (const [id, dimension] of Object.entries(DIMENSIONS)) {
      const signalTotal = SIGNALS.filter((signal) => signal.dimension === id).reduce(
        (sum, signal) => sum + signal.max,
        0,
      );
      expect(signalTotal, `dimension ${id}`).toBe(dimension.max);
    }
  });

  it("gives every signal a unique id, a rationale and a fix", () => {
    expect(new Set(SIGNALS.map((signal) => signal.id)).size).toBe(SIGNALS.length);
    for (const signal of SIGNALS) {
      expect(signal.why.length, signal.id).toBeGreaterThan(10);
      expect(signal.fix.length, signal.id).toBeGreaterThan(10);
    }
  });
});

describe("scoring", () => {
  it("never awards more than a signal's maximum and never goes negative", () => {
    const context = emptyContext();
    for (const signal of SIGNALS) {
      const outcome = signal.evaluate(context);
      expect(outcome.points, signal.id).toBeGreaterThanOrEqual(0);
      expect(outcome.points, signal.id).toBeLessThanOrEqual(signal.max);
    }
  });

  it("scores an unreachable store as F without throwing", () => {
    const result = score(emptyContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toBe("F");
    expect(result.dimensions.map((dimension) => dimension.id as DimensionId)).toEqual(
      Object.keys(DIMENSIONS) as DimensionId[],
    );
  });

  it("maps scores onto the published grade bands", () => {
    expect(grade(100)).toBe("A");
    expect(grade(90)).toBe("A");
    expect(grade(89)).toBe("B");
    expect(grade(75)).toBe("B");
    expect(grade(60)).toBe("C");
    expect(grade(40)).toBe("D");
    expect(grade(39)).toBe("F");
  });

  it("rewards a well-instrumented store more than a closed one", () => {
    const closed: CrawlContext = {
      ...emptyContext(),
      robots: parseRobots("User-agent: GPTBot\nDisallow: /\n", 200, true),
    };
    const closedScore = score(closed).score;
    const openScore = score(emptyContext()).score;
    expect(closedScore).toBeLessThanOrEqual(openScore);
  });
});
