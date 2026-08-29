import { SEAL_TIERS, embeddableTier, nextEmbeddableTier, nextTier, sealSvg, sealTier } from "@/lib/badge";
import { absoluteUrl } from "@/lib/site";

export function BadgeSnippet({
  slug,
  domain,
  score,
  scannedOn,
}: {
  slug: string;
  domain: string;
  score: number;
  scannedOn: string;
}) {
  const tier = sealTier(score);
  const embeddable = embeddableTier(score);
  const next = nextTier(score);
  const target = nextEmbeddableTier(score);
  const script = `<script src="${absoluteUrl("/badge.js")}" data-slug="${slug}" async></script>`;

  return (
    <div className="border-t-2 border-foreground pt-4">
      <p className="eyebrow">The seal</p>
      <h2 className="mt-2 font-serif text-2xl">{embeddable ? embeddable.title : "Not yet certified"}</h2>

      {embeddable ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {embeddable.claim} Paste this line where you want the seal: it is drawn at runtime, so it upgrades itself when
            you improve and removes itself if a deploy closes the shop to agents.
          </p>
          <div
            className="mt-4"
            /* Our own generated markup, not merchant input. */
            dangerouslySetInnerHTML={{ __html: sealSvg(embeddable, domain, scannedOn) }}
          />
          <pre className="mt-4 overflow-x-auto border border-border bg-background p-3 text-[11px] text-muted">
            <code>{script}</code>
          </pre>
          <p className="mt-3 text-xs text-muted">
            There is no image URL and no static version. The seal exists only as markup we serve per request, which is
            what makes it worth displaying.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {tier ? `${domain} is ${tier.title.toLowerCase()}: ${tier.claim}` : `${domain} is closed to agents today.`}{" "}
            {next ? `Reach ${next.threshold}/100 to earn ${next.title} and display it on your storefront.` : null}
          </p>
          {target ? (
            <div className="mt-4">
              {/* Greyed out on purpose: the seal a shop has not earned is shown as
                  the goal, never as something it can copy. */}
              <div
                aria-hidden
                className="w-fit select-none opacity-45 grayscale"
                dangerouslySetInnerHTML={{ __html: sealSvg(target, domain, "not yet earned") }}
              />
              <p className="mt-2 text-xs text-muted">
                Preview of {target.title}, greyed out until {domain} scores {target.threshold}/100. There is no embed code
                until it is earned.
              </p>
            </div>
          ) : null}
        </>
      )}

      <ul className="mt-4 divide-y divide-border text-xs text-muted">
        {SEAL_TIERS.map((entry) => (
          <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5">
            <span style={entry.id === embeddable?.id ? { color: entry.ink } : undefined}>{entry.title}</span>
            <span className="tabular">
              {entry.threshold}+{entry.embeddable ? "" : " · dashboard only"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
