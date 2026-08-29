import { describe, expect, it } from "vitest";
import { countFindings, findings, nextGradeTarget, verdictSentence } from "@/lib/rubric/findings";

function row(signalId: string, status: string, points: number, maxPoints: number) {
  return { id: signalId, signalId, status, points, maxPoints, detail: "" };
}

describe("findings", () => {
  it("puts a blocked agent requirement before a heavier non-required failure", () => {
    const list = findings([
      row("llms_txt", "fail", 0, 5),
      row("robots_ai_crawlers", "fail", 0, 10),
      row("machine_contact", "partial", 1, 2),
    ]);
    expect(list.map((finding) => finding.row.signalId)).toEqual([
      "robots_ai_crawlers",
      "llms_txt",
      "machine_contact",
    ]);
    expect(list[0].severity).toBe("blocker");
    expect(list[2].severity).toBe("polish");
  });

  it("titles a failing signal in the failing voice", () => {
    const [finding] = findings([row("robots_ai_crawlers", "fail", 0, 10)]);
    expect(finding.title).toBe("robots.txt turns AI crawlers away");
  });

  it("keeps the neutral title for a partial result", () => {
    const [finding] = findings([row("sitemap", "partial", 2.5, 4)]);
    expect(finding.title).toBe("Sitemap is discoverable and structured");
  });

  it("counts blockers separately from the rest", () => {
    const counts = countFindings([
      row("robots_ai_crawlers", "fail", 0, 10),
      row("sitemap", "partial", 2.5, 4),
      row("llms_txt", "pass", 5, 5),
    ]);
    expect(counts).toEqual({ blockers: 1, warnings: 1, passed: 1 });
  });

  it("reports how many fixes reach the next grade", () => {
    const target = nextGradeTarget(72, [row("robots_ai_crawlers", "fail", 0, 10), row("llms_txt", "fail", 0, 5)]);
    expect(target).toEqual({ count: 1, score: 82, grade: "B" });
  });

  it("returns no target when no fix changes the band", () => {
    expect(nextGradeTarget(41, [row("machine_contact", "partial", 1, 2)])).toBeNull();
  });
});

describe("verdictSentence", () => {
  it("names what works and what does not", () => {
    const sentence = verdictSentence("Allbirds", [
      { agent: { id: "answer" }, verdict: "ok" },
      { agent: { id: "shopping" }, verdict: "missing" },
    ]);
    expect(sentence).toBe("Agents can read and quote it, but cannot check out.");
  });

  it("says so when nothing works", () => {
    const sentence = verdictSentence("Coop", [{ agent: { id: "answer" }, verdict: "missing" }]);
    expect(sentence).toBe("No class of agent can use Coop today: they cannot read it.");
  });
});
