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

export const DEEP_AUDIT_PRICE_CHF = 99;
export const MONITOR_PRICE_CHF = 29;
export const AGENCY_PRICE_CHF = 149;

export function gradeColor(score: number): string {
  if (score >= 75) return "#38e08a";
  if (score >= 60) return "#9ade5a";
  if (score >= 40) return "#ffcc4d";
  return "#ff6b6b";
}
