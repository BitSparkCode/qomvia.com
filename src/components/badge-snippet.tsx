import { BADGE_HEIGHT, BADGE_WIDTH, absoluteUrl } from "@/lib/site";

export function BadgeSnippet({ slug, score }: { slug: string; score: number }) {
  const badgeUrl = absoluteUrl(`/badge/${slug}.svg`);
  const pageUrl = absoluteUrl(`/site/${slug}`);
  // The badge carries the Qomvia mark and links back to the score page, which is
  // what turns every proud merchant into a backlink.
  const script = `<script src="${absoluteUrl("/badge.js")}" data-slug="${slug}" async></script>`;
  const fallback = `<a href="${pageUrl}" title="Agent-readiness score by Qomvia" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="Qomvia agent-readiness score" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"></a>`;

  return (
    <div className="panel p-5">
      <h2 className="font-semibold">Embed the badge</h2>
      <p className="mt-2 text-sm text-muted">
        The badge updates automatically on every re-scan, so it always shows your current score.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/badge/${slug}.svg`}
        alt={`Agent-readiness score ${score} out of 100`}
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        className="mt-4"
      />
      <pre className="mt-4 overflow-x-auto border border-border bg-background p-3 text-[11px] text-muted">
        <code>{script}</code>
      </pre>
      <p className="mt-3 text-xs text-muted">Without JavaScript, paste this instead:</p>
      <pre className="mt-2 overflow-x-auto border border-border bg-background p-3 text-[11px] text-muted">
        <code>{fallback}</code>
      </pre>
    </div>
  );
}
