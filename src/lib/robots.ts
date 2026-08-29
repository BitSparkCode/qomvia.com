export type RobotsGroup = {
  agents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
};

export type RobotsFile = {
  found: boolean;
  status: number;
  groups: RobotsGroup[];
  sitemaps: string[];
  raw: string;
};

export const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-User",
  "Google-Extended",
  "Bingbot",
  "Applebot-Extended",
  "meta-externalagent",
] as const;

export function parseRobots(raw: string, status: number, found: boolean): RobotsFile {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastLineWasAgent = false;

  for (const line of raw.split(/\r?\n/)) {
    const withoutComment = line.split("#")[0].trim();
    if (!withoutComment) continue;
    const separator = withoutComment.indexOf(":");
    if (separator === -1) continue;
    const field = withoutComment.slice(0, separator).trim().toLowerCase();
    const value = withoutComment.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (field === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (field === "allow") current.allow.push(value);
    else if (field === "disallow") current.disallow.push(value);
    else if (field === "crawl-delay") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) current.crawlDelay = parsed;
    }
  }

  return { found, status, groups, sitemaps, raw };
}

function matches(pattern: string, path: string): boolean {
  if (pattern === "") return false;
  const anchoredEnd = pattern.endsWith("$");
  const body = anchoredEnd ? pattern.slice(0, -1) : pattern;
  const segments = body.split("*");
  let cursor = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === "") continue;
    const found = index === 0 ? (path.startsWith(segment) ? 0 : -1) : path.indexOf(segment, cursor);
    if (found === -1) return false;
    cursor = found + segment.length;
  }
  if (anchoredEnd) return cursor === path.length;
  return true;
}

function groupFor(robots: RobotsFile, agent: string): RobotsGroup | null {
  const needle = agent.toLowerCase();
  let wildcard: RobotsGroup | null = null;
  let best: RobotsGroup | null = null;
  let bestLength = -1;
  for (const group of robots.groups) {
    for (const candidate of group.agents) {
      if (candidate === "*") wildcard = wildcard ?? group;
      else if (needle.includes(candidate) && candidate.length > bestLength) {
        best = group;
        bestLength = candidate.length;
      }
    }
  }
  return best ?? wildcard;
}

/** Google-style longest-match evaluation, Allow wins ties. */
export function isAllowed(robots: RobotsFile, agent: string, path: string): boolean {
  if (!robots.found) return true;
  const group = groupFor(robots, agent);
  if (!group) return true;
  let bestAllow = -1;
  let bestDisallow = -1;
  for (const rule of group.allow) if (matches(rule, path)) bestAllow = Math.max(bestAllow, rule.length);
  for (const rule of group.disallow)
    if (matches(rule, path)) bestDisallow = Math.max(bestDisallow, rule.length);
  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}

export function blockedAgents(robots: RobotsFile, path = "/"): string[] {
  return AI_AGENTS.filter((agent) => !isAllowed(robots, agent, path));
}
