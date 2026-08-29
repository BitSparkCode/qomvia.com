import { describe, expect, it } from "vitest";
import { AGENT_INTERFACES, agentVerdicts, buildSignalLookup } from "@/lib/rubric/agents";
import { SIGNALS } from "@/lib/rubric/signals";
import { verdictFromStatus } from "@/components/score";

const titles = new Map(SIGNALS.map((signal) => [signal.id, signal.title]));

function lookupFor(statuses: Record<string, string>) {
  return buildSignalLookup(
    Object.entries(statuses).map(([signalId, status]) => ({ signalId, status })),
    titles,
  );
}

describe("agent interfaces", () => {
  it("only references signals the rubric actually measures", () => {
    const ids = new Set(SIGNALS.map((signal) => signal.id));
    for (const row of AGENT_INTERFACES) expect(ids.has(row.signalId)).toBe(true);
  });
});

describe("agentVerdicts", () => {
  it("blocks a class when a required signal fails", () => {
    const verdicts = agentVerdicts(
      lookupFor({ mcp_discovery: "fail", machine_contact: "pass", product_feed: "pass" }),
    );
    const mcp = verdicts.find((entry) => entry.agent.id === "mcp");
    expect(mcp?.verdict).toBe("missing");
    expect(mcp?.missing.length).toBeGreaterThan(0);
  });

  it("degrades to a warning when only helper signals are weak", () => {
    const verdicts = agentVerdicts(
      lookupFor({
        robots_ai_crawlers: "pass",
        bot_ua_response: "pass",
        server_rendered: "pass",
        llms_txt: "fail",
      }),
    );
    const answer = verdicts.find((entry) => entry.agent.id === "answer");
    expect(answer?.verdict).toBe("warn");
  });

  it("passes when every requirement and helper passes", () => {
    const verdicts = agentVerdicts(
      lookupFor({
        robots_ai_crawlers: "pass",
        bot_ua_response: "pass",
        server_rendered: "pass",
        sitemap: "pass",
        llms_txt: "pass",
        jsonld_product: "pass",
        robots_product_paths: "pass",
      }),
    );
    expect(verdicts.find((entry) => entry.agent.id === "answer")?.verdict).toBe("ok");
  });

  it("stays unknown when nothing about the class was measured", () => {
    const verdicts = agentVerdicts(lookupFor({}));
    expect(verdicts.every((entry) => entry.verdict === "unknown")).toBe(true);
  });
});

describe("verdictFromStatus", () => {
  it("maps rubric statuses onto the public icons", () => {
    expect(verdictFromStatus("pass")).toBe("ok");
    expect(verdictFromStatus("partial")).toBe("warn");
    expect(verdictFromStatus("fail")).toBe("missing");
    expect(verdictFromStatus("skipped")).toBe("unknown");
  });
});
