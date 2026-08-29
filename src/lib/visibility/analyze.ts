export type AnswerAnalysis = {
  mentioned: boolean;
  cited: boolean;
  /** 1-based position of the first brand mention among all retailers named. */
  rank: number | null;
  competitors: string[];
};

export type BrandIdentity = {
  name: string;
  domain: string;
  aliases?: string[];
};

const KNOWN_HOST_NOISE = new Set([
  "www",
  "com",
  "org",
  "net",
  "shop",
  "store",
  "online",
  "reddit",
  "youtube",
  "wikipedia",
  "instagram",
  "facebook",
  "tiktok",
  "amazon",
  "google",
  "trustpilot",
]);

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandPatterns(brand: BrandIdentity): string[] {
  const bare = brand.domain.replace(/^www\./, "");
  const label = bare.split(".")[0];
  return [brand.name, bare, label, ...(brand.aliases ?? [])]
    .map((value) => value.trim())
    .filter((value) => value.length >= 3);
}

/** Turns a URL into the retailer label we compare against, e.g. `digitec.ch`. */
export function registrableHost(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const label = host.split(".")[0];
    if (KNOWN_HOST_NOISE.has(label)) return host;
    return host;
  } catch {
    return null;
  }
}

/**
 * Measures one answer: was the shop named, was it linked, in which position
 * relative to the other retailers, and which competitors took the slots.
 */
export function analyzeAnswer(
  answer: string,
  citations: string[],
  brand: BrandIdentity,
  watched: { name: string; domain: string }[] = [],
): AnswerAnalysis {
  const haystack = answer.toLowerCase();
  const patterns = brandPatterns(brand).map((value) => value.toLowerCase());

  let firstIndex = -1;
  for (const pattern of patterns) {
    const match = new RegExp(`(?:^|[^a-z0-9])${escape(pattern)}(?:[^a-z0-9]|$)`).exec(haystack);
    if (match && (firstIndex === -1 || match.index < firstIndex)) firstIndex = match.index;
  }
  const mentioned = firstIndex >= 0;

  const brandHosts = new Set([brand.domain.replace(/^www\./, "").toLowerCase()]);
  const cited = citations.some((url) => {
    const host = registrableHost(url);
    return host ? brandHosts.has(host) || host.endsWith(`.${brand.domain}`) : false;
  });

  // Retailers named in the answer, in the order they appear, so rank means
  // "how far down the recommendation list is this shop".
  const domainMatches = [...haystack.matchAll(/\b([a-z0-9][a-z0-9-]{1,40})\.(ch|de|at|com|eu|io|co\.uk|fr|it|nl)\b/g)];
  const ordered: { host: string; index: number }[] = domainMatches.map((match) => ({
    host: `${match[1]}.${match[2]}`,
    index: match.index ?? 0,
  }));
  for (const url of citations) {
    const host = registrableHost(url);
    if (host && !ordered.some((entry) => entry.host === host)) {
      ordered.push({ host, index: Number.MAX_SAFE_INTEGER });
    }
  }

  // A watched competitor is often named without its domain ("Zalando recommends…"),
  // so its label is matched as a word too.
  for (const competitor of watched) {
    const host = competitor.domain.replace(/^www\./, "").toLowerCase();
    if (ordered.some((entry) => entry.host === host)) continue;
    const labels = [competitor.name, host.split(".")[0]].map((value) => value.trim().toLowerCase());
    for (const label of labels) {
      if (label.length < 3) continue;
      // "ochsner-sport" is written "Ochsner Sport" in prose.
      const pattern = escape(label).replace(/-/g, "[\\s-]");
      const match = new RegExp(`(?:^|[^a-z0-9])${pattern}(?:[^a-z0-9]|$)`).exec(haystack);
      if (match) {
        ordered.push({ host, index: match.index });
        break;
      }
    }
  }

  const watchedHosts = new Set(watched.map((entry) => entry.domain.replace(/^www\./, "").toLowerCase()));
  const retailers: string[] = [];
  for (const entry of ordered.sort((a, b) => a.index - b.index)) {
    const label = entry.host.split(".")[0];
    if (KNOWN_HOST_NOISE.has(label) && !watchedHosts.has(entry.host)) continue;
    if (!retailers.includes(entry.host)) retailers.push(entry.host);
  }

  const brandHost = brand.domain.replace(/^www\./, "").toLowerCase();
  const position = retailers.indexOf(brandHost);
  const rank = mentioned ? (position >= 0 ? position + 1 : retailers.length + 1) : null;

  return {
    mentioned,
    cited,
    rank,
    competitors: retailers.filter((host) => host !== brandHost).slice(0, 10),
  };
}

export type RunAggregate = {
  score: number;
  mentionRate: number;
  citationRate: number;
  avgRank: number | null;
  /** `share` is a 0-1 fraction of answers the competitor appeared in. */
  shareOfVoice: { host: string; answers: number; share: number }[];
};

/**
 * Visibility index: presence is what matters most, being linked next, and being
 * named first rather than fifth last. 0-100 so it reads like the readiness score.
 */
export function aggregateRun(
  results: { mentioned: boolean; cited: boolean; rank: number | null; competitors: string[] }[],
): RunAggregate {
  if (results.length === 0) {
    return { score: 0, mentionRate: 0, citationRate: 0, avgRank: null, shareOfVoice: [] };
  }

  const mentions = results.filter((result) => result.mentioned);
  const mentionRate = mentions.length / results.length;
  const citationRate = results.filter((result) => result.cited).length / results.length;
  const ranks = mentions.map((result) => result.rank).filter((rank): rank is number => rank !== null);
  const avgRank = ranks.length > 0 ? ranks.reduce((total, rank) => total + rank, 0) / ranks.length : null;

  const rankQuality = avgRank === null ? 0 : Math.max(0, 1 - (avgRank - 1) / 5);
  const score = Math.round(100 * (0.6 * mentionRate + 0.2 * citationRate + 0.2 * mentionRate * rankQuality));

  const counts = new Map<string, number>();
  for (const result of results) {
    for (const host of new Set(result.competitors)) counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  const shareOfVoice = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([host, answers]) => ({ host, answers, share: answers / results.length }));

  return { score, mentionRate, citationRate, avgRank, shareOfVoice };
}
