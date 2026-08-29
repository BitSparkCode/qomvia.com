import type { FetchOutcome } from "@/lib/http";
import type { RobotsFile } from "@/lib/robots";

export const RUBRIC_VERSION = "1.0.0";

export const DIMENSIONS = {
  access: { label: "Machine access", max: 25 },
  data: { label: "Product data legibility", max: 25 },
  protocols: { label: "Agent-commerce protocols", max: 20 },
  checkout: { label: "Checkout traversability", max: 15 },
  performance: { label: "Agent-facing performance", max: 10 },
  policy: { label: "Policy clarity", max: 5 },
} as const;

export type DimensionId = keyof typeof DIMENSIONS;

export type SignalStatus = "pass" | "partial" | "fail" | "unknown";

export type SignalOutcome = {
  points: number;
  status: SignalStatus;
  detail: string;
  evidence?: Record<string, unknown>;
};

export type Signal = {
  id: string;
  dimension: DimensionId;
  title: string;
  max: number;
  why: string;
  fix: string;
  evaluate: (context: CrawlContext) => SignalOutcome;
};

export type JsonLdNode = Record<string, unknown>;

export type PageSnapshot = {
  url: string;
  outcome: FetchOutcome;
  jsonLd: JsonLdNode[];
  /** Visible text length of the server-rendered HTML, i.e. what a non-browser agent sees. */
  textLength: number;
  title: string;
  forms: { action: string; method: string; inputs: { name: string; type: string; autocomplete: string }[] }[];
  links: string[];
};

export type CrawlContext = {
  domain: string;
  origin: string;
  robots: RobotsFile;
  botHome: FetchOutcome;
  browserHome: FetchOutcome;
  home: PageSnapshot | null;
  category: PageSnapshot | null;
  product: PageSnapshot | null;
  checkout: PageSnapshot | null;
  wellKnown: Record<string, FetchOutcome>;
  sitemaps: { url: string; status: number; urlCount: number; isIndex: boolean }[];
  feeds: { url: string; status: number; contentType: string }[];
  urlsFetched: number;
  notes: string[];
};

export type DimensionScore = {
  id: DimensionId;
  label: string;
  points: number;
  max: number;
};

export type ScanResult = {
  score: number;
  grade: string;
  dimensions: DimensionScore[];
  signals: (SignalOutcome & { id: string; dimension: DimensionId; title: string; max: number })[];
  rubricVersion: string;
  urlsFetched: number;
};

export function grade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
