export const SITE_NAME = "Qomvia";
export const SITE_TAGLINE = "Can AI agents actually buy from your store?";

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://qomvia.com";
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Intrinsic size of the embeddable badge, shared by the SVG route and the embed snippet. */
export const BADGE_WIDTH = 320;
export const BADGE_HEIGHT = 76;

export const MONITOR_PRICE_CHF = 29;
export const AGENCY_PRICE_CHF = 149;

export function gradeColor(score: number): string {
  if (score >= 75) return "#1d4d3e";
  if (score >= 60) return "#4a6b2f";
  if (score >= 40) return "#8a6316";
  return "#9a2b2b";
}
