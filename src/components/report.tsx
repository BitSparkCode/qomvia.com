import Link from "next/link";
import type { ReactNode } from "react";
import { StatusIcon, type Verdict } from "@/components/score";
import type { Effort } from "@/lib/rubric/types";
import type { Severity } from "@/lib/rubric/findings";

const SEVERITY_LABEL: Record<Severity, { label: string; className: string }> = {
  blocker: { label: "Blocker", className: "text-bad border-bad" },
  improvement: { label: "Improvement", className: "text-warn border-warn" },
  polish: { label: "Polish", className: "text-muted border-border" },
};

const EFFORT_LABEL: Record<Effort, string> = {
  minutes: "minutes",
  hours: "a few hours",
  ticket: "dev ticket",
};

export function SeverityTag({ severity }: { severity: Severity }) {
  const style = SEVERITY_LABEL[severity];
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-widest ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export function EffortTag({ effort }: { effort: Effort }) {
  return <span className="font-mono text-[0.625rem] uppercase tracking-widest text-muted">{EFFORT_LABEL[effort]}</span>;
}

/** The three numbers a merchant reads before anything else. */
export function CountStrip({
  items,
}: {
  items: { label: string; value: number | string; tone?: "bad" | "warn" | "ok" }[];
}) {
  const tone = { bad: "text-bad", warn: "text-warn", ok: "text-accent" } as const;
  return (
    <dl className="grid grid-cols-3 divide-x divide-border border-y border-border">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-4 first:pl-0 last:pr-0">
          <dd className={`font-serif text-3xl leading-none ${item.tone ? tone[item.tone] : ""}`}>{item.value}</dd>
          <dt className="mt-2 font-mono text-[0.625rem] uppercase tracking-widest text-muted">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Detail is opt-in everywhere: nothing expensive to read is expanded by default. */
export function Disclosure({
  summary,
  children,
  count,
}: {
  summary: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm">
        <span className="link-underline">{summary}</span>
        <span className="font-mono text-xs text-muted">
          {count === undefined ? "" : `${count} `}
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

/**
 * Stands in for a section only signed-in merchants may read. The blurred rows
 * are placeholders, so the withheld detail is absent from the response rather
 * than merely hidden by CSS.
 */
export function LockedPanel({
  title,
  promise,
  rows,
}: {
  title: string;
  promise: string;
  rows: number;
}) {
  const widths = ["82%", "64%", "91%", "57%", "74%", "88%"];
  return (
    <section className="relative overflow-hidden border-t border-border">
      <ul aria-hidden className="select-none divide-y divide-border blur-[5px]" style={{ opacity: 0.5 }}>
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="flex items-center gap-3 py-3">
            <span className="h-4 w-4 shrink-0 rounded-full bg-rule" />
            <span className="h-3 bg-rule" style={{ width: widths[index % widths.length] }} />
          </li>
        ))}
      </ul>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 px-6 text-center">
        <p className="eyebrow">Members only</p>
        <p className="font-serif text-lg leading-snug">{title}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted">{promise}</p>
        <Link href="/login" className="btn mt-1 text-sm">
          Create a free account
        </Link>
      </div>
    </section>
  );
}

/** Evidence as a table of what was requested and what came back, not a JSON dump. */
export function EvidenceTable({ evidence }: { evidence: unknown }) {
  const rows = flatten(evidence);
  if (rows.length === 0) return null;
  return (
    <table className="w-full border-collapse text-xs">
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="w-44 py-1.5 pr-4 text-left align-top font-mono font-normal text-muted">
              {row.key}
            </th>
            <td className="py-1.5 align-top break-all">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function flatten(value: unknown, prefix = ""): { key: string; value: string }[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry !== "object" || entry === null)) {
      return [{ key: prefix || "values", value: value.join(", ") }];
    }
    return value.flatMap((entry, index) => flatten(entry, prefix ? `${prefix}[${index}]` : `[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      flatten(entry, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [{ key: prefix || "value", value: String(value) }];
}

export function VerdictRow({
  verdict,
  title,
  note,
  children,
}: {
  verdict: Verdict;
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 py-3">
      <StatusIcon verdict={verdict} />
      <div className="min-w-0 space-y-1">
        <p className="text-sm leading-snug">{title}</p>
        {note ? <p className="text-sm leading-relaxed text-muted">{note}</p> : null}
        {children}
      </div>
    </li>
  );
}
