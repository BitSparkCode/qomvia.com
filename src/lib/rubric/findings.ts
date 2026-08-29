import { AGENT_CLASSES, type AgentClassId } from "@/lib/rubric/agents";
import { SIGNALS } from "@/lib/rubric/signals";
import { grade, type Effort, type Signal, type SignalStatus } from "@/lib/rubric/types";

/** Severity, in the reader's order rather than the rubric's. */
export type Severity = "blocker" | "improvement" | "polish";

export type ScanSignalRow = {
  id: string;
  signalId: string;
  status: string;
  points: number;
  maxPoints: number;
  detail: string;
  evidence?: unknown;
};

export type Finding = {
  row: ScanSignalRow;
  signal: Signal | undefined;
  status: SignalStatus;
  severity: Severity;
  /** Points still on the table, which is what orders the fix list. */
  lost: number;
  effort: Effort;
  title: string;
};

const EFFORT_ORDER: Record<Effort, number> = { minutes: 0, hours: 1, ticket: 2 };

/**
 * A finding blocks when it fails outright and something a real agent needs
 * depends on it: either a required capability of an agent class, or a signal
 * heavy enough that the shop cannot reach a passing grade while it fails.
 */
const REQUIRED_SIGNALS = new Set(AGENT_CLASSES.flatMap((agent) => agent.requires));

export function severityOf(row: { status: string; points: number; maxPoints: number }, signal?: Signal): Severity {
  const lost = row.maxPoints - row.points;
  if (row.status === "fail" && signal && REQUIRED_SIGNALS.has(signal.id)) return "blocker";
  if (row.status === "fail" && lost >= 5) return "blocker";
  if (lost >= 1.5) return "improvement";
  return "polish";
}

/** Everything not passing, ordered by severity, then cheapest fix, then points lost. */
export function findings(rows: ScanSignalRow[]): Finding[] {
  const byId = new Map(SIGNALS.map((signal) => [signal.id, signal]));
  const severityRank: Record<Severity, number> = { blocker: 0, improvement: 1, polish: 2 };

  return rows
    .filter((row) => row.status !== "pass")
    .map((row) => {
      const signal = byId.get(row.signalId);
      const status = row.status as SignalStatus;
      return {
        row,
        signal,
        status,
        severity: severityOf(row, signal),
        lost: Math.round((row.maxPoints - row.points) * 100) / 100,
        effort: signal?.effort ?? "hours",
        title: (status === "fail" ? signal?.failTitle : signal?.title) ?? row.signalId,
      };
    })
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] ||
        b.lost - a.lost,
    );
}

export type FindingCounts = { blockers: number; warnings: number; passed: number };

export function countFindings(rows: ScanSignalRow[]): FindingCounts {
  const list = findings(rows);
  return {
    blockers: list.filter((finding) => finding.severity === "blocker").length,
    warnings: list.filter((finding) => finding.severity !== "blocker").length,
    passed: rows.filter((row) => row.status === "pass").length,
  };
}

export type GradeTarget = { count: number; score: number; grade: string } | null;

/**
 * "Fix these N and you reach grade B": the smallest prefix of the fix list that
 * crosses the next grade band, so the report has a goal instead of a backlog.
 */
export function nextGradeTarget(score: number, rows: ScanSignalRow[]): GradeTarget {
  const current = grade(score);
  const list = findings(rows);
  let projected = score;
  for (let index = 0; index < list.length; index += 1) {
    projected += list[index].lost;
    const reached = grade(Math.min(100, Math.round(projected)));
    if (reached !== current) {
      return { count: index + 1, score: Math.min(100, Math.round(projected)), grade: reached };
    }
  }
  return null;
}

const CLASS_VERB: Record<AgentClassId, { ok: string; broken: string }> = {
  answer: { ok: "read and quote it", broken: "read it" },
  shopping: { ok: "buy from it", broken: "check out" },
  mcp: { ok: "call it as a tool", broken: "call it as a tool" },
  integrator: { ok: "ingest the catalogue", broken: "ingest the catalogue" },
  comparison: { ok: "compare its prices", broken: "compare its prices" },
  payments: { ok: "pay it directly", broken: "pay without a human" },
};

/**
 * The one sentence at the top of the public page: what works, what does not,
 * in the merchant's language rather than as a score.
 */
export function verdictSentence(
  brandName: string,
  verdicts: { agent: { id: AgentClassId }; verdict: string }[],
): string {
  const working = verdicts.filter((entry) => entry.verdict === "ok").map((entry) => CLASS_VERB[entry.agent.id].ok);
  const broken = verdicts
    .filter((entry) => entry.verdict === "missing")
    .map((entry) => CLASS_VERB[entry.agent.id].broken);

  if (broken.length === 0 && working.length > 0) {
    return `Agents can ${list(working)} — ${brandName} is usable end to end.`;
  }
  if (working.length === 0) {
    return `No class of agent can use ${brandName} today: they cannot ${list(broken.slice(0, 3))}.`;
  }
  return `Agents can ${list(working.slice(0, 2))}, but cannot ${list(broken.slice(0, 2))}.`;
}

function list(items: string[]): string {
  const unique = [...new Set(items)];
  if (unique.length <= 1) return unique[0] ?? "";
  return `${unique.slice(0, -1).join(", ")} or ${unique[unique.length - 1]}`;
}
