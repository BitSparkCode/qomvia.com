import { robotHeadInner } from "@/lib/logo";
import { BADGE_HEIGHT, BADGE_WIDTH } from "@/lib/site";

export type SealTier = {
  id: "champion" | "ready" | "readable" | "progress";
  title: string;
  threshold: number;
  /** Below the embeddable floor a tier is dashboard-only: a shop agents cannot buy from must not carry a public mark. */
  embeddable: boolean;
  ink: string;
  claim: string;
};

export const SEAL_TIERS: SealTier[] = [
  {
    id: "champion",
    title: "AI Commerce Champion",
    threshold: 90,
    embeddable: true,
    ink: "#1d4d3e",
    claim: "Every agent class can find, read and buy your products.",
  },
  {
    id: "ready",
    title: "AI Commerce Ready",
    threshold: 75,
    embeddable: true,
    ink: "#17181b",
    claim: "Shopping agents can complete a purchase without a human.",
  },
  {
    id: "readable",
    title: "Agent-Readable",
    threshold: 60,
    embeddable: true,
    ink: "#4a6b2f",
    claim: "Agents can read your catalogue, but checkout or protocols still break.",
  },
  {
    id: "progress",
    title: "In Progress",
    threshold: 40,
    embeddable: false,
    ink: "#8a6316",
    claim: "Partly readable. Not yet good enough to display a public mark.",
  },
];

export function sealTier(score: number | null | undefined): SealTier | null {
  if (typeof score !== "number") return null;
  return SEAL_TIERS.find((tier) => score >= tier.threshold) ?? null;
}

export function embeddableTier(score: number | null | undefined): SealTier | null {
  const tier = sealTier(score);
  return tier && tier.embeddable ? tier : null;
}

export function nextTier(score: number | null | undefined): SealTier | null {
  if (typeof score !== "number") return null;
  const above = SEAL_TIERS.filter((tier) => tier.threshold > score);
  return above.length ? above[above.length - 1] : null;
}

const FONT = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif";

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * The seal states a qualification, not a number: a score goes stale the moment
 * the shop changes, and a merchant has no reason to advertise one.
 */
export function sealSvg(tier: SealTier, domain: string, verifiedOn: string): string {
  const label = domain.length > 28 ? `${domain.slice(0, 27)}…` : domain;
  const size = tier.title.length > 18 ? 15.5 : 17;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(label)} is verified ${escapeXml(tier.title)} by Qomvia">
  <rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="4" fill="#fbfaf7"/>
  <rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="4" fill="none" stroke="${tier.ink}"/>
  <g transform="translate(16 18) scale(1.25)">${robotHeadInner({}, { animated: true })}</g>
  <text x="70" y="28" font-family="${FONT}" font-size="9.5" fill="#6a675f" letter-spacing="1.2">VERIFIED BY QOMVIA</text>
  <text x="70" y="49" font-family="${FONT}" font-size="${size}" font-weight="600" fill="${tier.ink}">${escapeXml(tier.title)}</text>
  <text x="70" y="63" font-family="${FONT}" font-size="9.5" fill="#6a675f">${escapeXml(label)} · ${escapeXml(verifiedOn)}</text>
</svg>`;
}
