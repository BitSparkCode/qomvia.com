import { gradeColor } from "@/lib/site";
import type { DimensionScore } from "@/lib/rubric/types";

export function ScoreDial({ score, grade, size = 148 }: { score: number; grade: string; size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const color = gradeColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e0dcd2" strokeWidth={2} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={`${(circumference * score) / 100} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="49%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={size * 0.34}
        fontFamily="var(--font-serif), Georgia, serif"
      >
        {score}
      </text>
      <text
        x="50%"
        y="72%"
        textAnchor="middle"
        fill="#6a675f"
        fontSize={size * 0.085}
        letterSpacing={size * 0.012}
        fontFamily="var(--font-mono), ui-monospace, monospace"
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
  ok: { glyph: "✓", className: "text-accent border-accent", label: "ok" },
  warn: { glyph: "!", className: "text-warn border-warn", label: "needs attention" },
  missing: { glyph: "✕", className: "text-bad border-bad", label: "missing" },
  unknown: { glyph: "?", className: "text-muted border-border", label: "not determined" },
};

export function StatusIcon({ verdict, size = 20 }: { verdict: Verdict; size?: number }) {
  const style = VERDICT[verdict];
  return (
    <span
      role="img"
      aria-label={style.label}
      title={style.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border leading-none ${style.className}`}
      style={{ width: size, height: size, fontSize: size * 0.58 }}
    >
      {style.glyph}
    </span>
  );
}

export function DimensionList({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <ul className="divide-y divide-border">
      {dimensions.map((dimension) => (
        <li key={dimension.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
          <StatusIcon verdict={verdictFromShare(dimension.points, dimension.max)} />
          <span>{dimension.label}</span>
        </li>
      ))}
    </ul>
  );
}
