import { absoluteUrl } from "@/lib/site";

export function BadgeSnippet({ slug, score }: { slug: string; score: number }) {
  const badgeUrl = absoluteUrl(`/badge/${slug}.svg`);
  const pageUrl = absoluteUrl(`/site/${slug}`);
  // The badge carries the Qomvia mark and links back to the score page, which is
  // what turns every proud merchant into a backlink.
  const snippet = `<a href="${pageUrl}" title="Agent-readiness score by Qomvia" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="Qomvia agent-readiness score ${score}/100" width="200" height="40"></a>`;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Embed the badge</h2>
      <p className="mt-2 text-sm text-muted">
        The badge updates automatically on every re-scan, so it always shows your current score.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/badge/${slug}.svg`} alt={`Agent-readiness score ${score} out of 100`} width={200} height={40} className="mt-4" />
      <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-background p-3 text-[11px] text-muted">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
