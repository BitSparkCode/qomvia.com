/** Navigation shared by the header dropdowns, the mobile menu and the footer. */
export type NavLink = { href: string; label: string; description?: string };
export type NavGroup = { label: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Product",
    links: [
      {
        href: "/",
        label: "Agent-readiness score",
        description: "Measure whether agents can read your catalogue and reach checkout.",
      },
      {
        href: "/visibility",
        label: "LLM product visibility",
        description: "Track every product across the major models, per market.",
      },
      {
        href: "/pricing",
        label: "Monitoring & alerts",
        description: "Weekly re-scans and an alert when a deploy breaks agent access.",
      },
    ],
  },
  {
    label: "Data",
    links: [
      { href: "/leaderboard", label: "Leaderboard", description: "Every scored storefront, ranked." },
      { href: "/report", label: "The index", description: "Aggregate state of agent commerce." },
      { href: "/api/docs", label: "Public API", description: "Scores as JSON, free to cite." },
    ],
  },
  {
    label: "Trust",
    links: [
      { href: "/methodology", label: "Methodology", description: "How scores are measured, and what our crawler will never do." },
      { href: "/bot", label: "About our crawler", description: "What QomviaBot does, and never does." },
      { href: "/opt-out", label: "Opt out", description: "Remove a storefront from the public index." },
    ],
  },
];

export const NAV_DIRECT: NavLink[] = [{ href: "/pricing", label: "Pricing" }];
