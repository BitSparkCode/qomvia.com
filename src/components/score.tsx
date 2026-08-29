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

export function DimensionBars({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <ul className="space-y-3">
      {dimensions.map((dimension) => {
        const share = dimension.max === 0 ? 0 : (dimension.points / dimension.max) * 100;
        return (
          <li key={dimension.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span>{dimension.label}</span>
              <span className="font-mono text-muted">
                {dimension.points}/{dimension.max}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full"
                style={{ width: `${share}%`, background: gradeColor(share) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pass: "text-accent border-accent/40 bg-accent/10",
  partial: "text-warn border-warn/40 bg-warn/10",
  fail: "text-bad border-bad/40 bg-bad/10",
  unknown: "text-muted border-border bg-surface",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLE[status] ?? STATUS_STYLE.unknown}`}>
      {status}
    </span>
  );
}
