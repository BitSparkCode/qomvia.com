import { describe, expect, it } from "vitest";
import { adviceFor, answerVerdict, evidenceFor, groupByProduct } from "@/lib/visibility/overview";
import type { ProductAnswer } from "@/lib/visibility/overview";

function answer(overrides: Partial<ProductAnswer> = {}): ProductAnswer {
  return {
    provider: "openai",
    model: "gpt-4.1-mini",
    locale: "de-CH",
    question: "Wo kaufen?",
    shown: true,
    cited: true,
    rank: 1,
    winner: null,
    competitors: [],
    evidence: "…",
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    provider: "openai",
    model: "gpt-4.1-mini",
    mentioned: true,
    cited: false,
    rank: 3,
    competitors: ["rival.ch"],
    answer: "rival.ch und ourshop.ch führen das Modell.",
    prompt: { text: "Wo kaufen?", locale: "de-CH", productId: "p1" },
    ...overrides,
  };
}

describe("evidenceFor", () => {
  it("returns short answers unchanged", () => {
    expect(evidenceFor("  Short   answer ", ["ourshop"])).toBe("Short answer");
  });

  it("windows a long answer around the first named shop", () => {
    const long = `${"x".repeat(600)} rival.ch recommends ${"y".repeat(600)}`;
    const evidence = evidenceFor(long, ["rival.ch"]);
    expect(evidence).toContain("rival.ch");
    expect(evidence.length).toBeLessThan(400);
  });

  it("falls back to the head of the answer when nothing matches", () => {
    const evidence = evidenceFor("z".repeat(900), ["absent.ch"]);
    expect(evidence.startsWith("z")).toBe(true);
    expect(evidence.endsWith("…")).toBe(true);
  });
});

describe("answerVerdict", () => {
  it("names the winner when the shop is absent", () => {
    expect(answerVerdict(answer({ shown: false, cited: false, rank: null, winner: "rival.ch" }))).toBe(
      "Not shown — rival.ch was recommended instead",
    );
  });

  it("reports position and whether it was linked", () => {
    expect(answerVerdict(answer({ rank: 2, cited: false }))).toBe("Shown at position 2 · named, not linked");
  });
});

describe("adviceFor", () => {
  it("points at the shops answering instead when invisible", () => {
    const advice = adviceFor([answer({ shown: false, cited: false, rank: null, winner: "rival.ch" })]);
    expect(advice).toContain("rival.ch");
  });

  it("asks for JSON-LD when named but never linked", () => {
    expect(adviceFor([answer({ cited: false })])).toContain("JSON-LD");
  });

  it("says nothing was asked when there are no answers", () => {
    expect(adviceFor([])).toContain("Not asked about yet");
  });
});

describe("groupByProduct", () => {
  const products = [
    { id: "p1", title: "Shoe", url: null, priceCents: 1000, currency: "CHF" },
    { id: "p2", title: "Jacket", url: null, priceCents: 2000, currency: "CHF" },
  ];

  it("sorts the least visible product first and counts rivals", () => {
    const grouped = groupByProduct(
      [
        row(),
        row({ prompt: { text: "Wo kaufen?", locale: "fr-CH", productId: "p2" }, mentioned: false, rank: null }),
      ],
      products,
      ["Our Shop", "ourshop.ch"],
    );

    expect(grouped.map((entry) => entry.productId)).toEqual(["p2", "p1"]);
    expect(grouped[1].shown).toBe(1);
    expect(grouped[1].bestRank).toBe(3);
    expect(grouped[0].rivals).toEqual([{ host: "rival.ch", answers: 1 }]);
  });

  it("ignores results from prompts that are not product-specific", () => {
    const grouped = groupByProduct([row({ prompt: { text: "Brand?", locale: "de-CH", productId: null } })], products, []);
    expect(grouped.every((entry) => entry.asked === 0)).toBe(true);
  });
});
