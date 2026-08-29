import { gradeColor } from "@/lib/site";
import type { DimensionScore } from "@/lib/rubric/types";

export function ScoreDial({ score, grade, size = 148 }: { score: number; grade: string; size?: number }) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const color = gradeColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e2632" strokeWidth={10} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(circumference * score) / 100} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={size * 0.28}
        fontWeight={700}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {score}
      </text>
      <text
        x="50%"
        y="68%"
        textAnchor="middle"
        fill="#8d9bad"
        fontSize={size * 0.11}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        GRADE {grade}
      </text>
    </svg>
  );
}

/** Verdicts are shown as symbols, never as point arithmetic. */
export type Verdict = "ok" | "warn" | "missing" | "unknown";

export function verdictFromStatus(status: string): Verdict {
  if (status === "pass") return "ok";
  if (status === "partial") return "warn";
  if (status === "fail") return "missing";
  return "unknown";
}

export function verdictFromShare(points: number, max: number): Verdict {
  if (max === 0) return "unknown";
  const share = points / max;
  if (share >= 0.85) return "ok";
  if (share >= 0.4) return "warn";
  return "missing";
}

const VERDICT: Record<Verdict, { glyph: string; className: string; label: string }> = {
  ok: { glyph: "✓", className: "text-accent border-accent/40 bg-accent/10", label: "ok" },
  warn: { glyph: "!", className: "text-warn border-warn/40 bg-warn/10", label: "needs attention" },
  missing: { glyph: "✕", className: "text-bad border-bad/40 bg-bad/10", label: "missing" },
  unknown: { glyph: "?", className: "text-muted border-border bg-surface", label: "not determined" },
};

export function StatusIcon({ verdict, size = 22 }: { verdict: Verdict; size?: number }) {
  const style = VERDICT[verdict];
  return (
    <span
      role="img"
      aria-label={style.label}
      title={style.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-semibold leading-none ${style.className}`}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      {style.glyph}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const verdict = verdictFromStatus(status);
  return <StatusIcon verdict={verdict} />;
}

export function DimensionList({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <ul className="space-y-3">
      {dimensions.map((dimension) => (
        <li key={dimension.id} className="flex items-center gap-3 text-sm">
          <StatusIcon verdict={verdictFromShare(dimension.points, dimension.max)} />
          <span>{dimension.label}</span>
        </li>
      ))}
    </ul>
  );
}
