import { prisma } from "@/lib/db";

/** One model's answer to one question about one product. */
export type ProductAnswer = {
  provider: string;
  model: string;
  locale: string;
  question: string;
  shown: boolean;
  cited: boolean;
  rank: number | null;
  /** The shop the answer recommended first when ours was absent or lower. */
  winner: string | null;
  competitors: string[];
  /** The part of the answer the verdict was read from. */
  evidence: string;
};

export type ProductVisibility = {
  productId: string;
  title: string;
  url: string | null;
  priceCents: number | null;
  currency: string | null;
  answers: ProductAnswer[];
  shown: number;
  asked: number;
  bestRank: number | null;
  /** Shops that took the slot most often across this product's answers. */
  rivals: { host: string; answers: number }[];
  advice: string;
};

const EVIDENCE_CHARS = 320;

/**
 * The sentence a merchant should read, not the whole answer: the window around
 * the first retailer named, which is where the recommendation actually happens.
 */
export function evidenceFor(answer: string, focus: string[]): string {
  const flat = answer.replace(/\s+/g, " ").trim();
  if (flat.length <= EVIDENCE_CHARS) return flat;

  const haystack = flat.toLowerCase();
  let at = -1;
  for (const needle of focus) {
    const label = needle.trim().toLowerCase();
    if (label.length < 3) continue;
    const index = haystack.indexOf(label);
    if (index >= 0 && (at === -1 || index < at)) at = index;
  }
  if (at === -1) return `${flat.slice(0, EVIDENCE_CHARS)}…`;

  const start = Math.max(0, at - Math.floor(EVIDENCE_CHARS / 3));
  const cut = flat.slice(start, start + EVIDENCE_CHARS);
  return `${start > 0 ? "…" : ""}${cut}${start + EVIDENCE_CHARS < flat.length ? "…" : ""}`;
}

/** The plain-language verdict for one answer, which is the whole point of the row. */
export function answerVerdict(answer: ProductAnswer): string {
  if (!answer.shown) {
    return answer.winner ? `Not shown — ${answer.winner} was recommended instead` : "Not shown";
  }
  const place = answer.rank ? `shown at position ${answer.rank}` : "shown";
  const how = answer.cited ? "named and linked" : "named, not linked";
  return `${place[0].toUpperCase()}${place.slice(1)} · ${how}`;
}

/** What to do about this product, derived from its own answers rather than the run average. */
export function adviceFor(answers: ProductAnswer[]): string {
  if (answers.length === 0) return "Not asked about yet. Track it to include it in the next run.";
  const shown = answers.filter((answer) => answer.shown);
  const cited = shown.filter((answer) => answer.cited);
  const rivals = [...new Set(answers.flatMap((answer) => (answer.winner ? [answer.winner] : [])))];

  if (shown.length === 0) {
    return rivals.length > 0
      ? `Invisible for this product. The models answer with ${rivals.slice(0, 3).join(", ")} — match what those pages state plainly: product name, price, availability and shipping in the page's own markup.`
      : "Invisible for this product. No retailer was named at all, so the phrasing is informational: publish a page that answers the question itself, not just a product listing.";
  }
  if (cited.length === 0) {
    return "Named but never linked. The models know the shop and send the click elsewhere — add product JSON-LD with price and availability so your page is the citable source.";
  }
  const ranks = shown.map((answer) => answer.rank).filter((rank): rank is number => rank !== null);
  const best = ranks.length > 0 ? Math.min(...ranks) : null;
  if (best !== null && best > 3) {
    return `Listed, but at position ${best}. Answers rank on specifics: state the exact variant, size or weight, the price and the delivery time on the product page.`;
  }
  return `Shown in ${shown.length} of ${answers.length} answers, linked in ${cited.length}. Keep the page's price and availability accurate — that is what the models re-check.`;
}

type ResultRow = {
  provider: string;
  model: string;
  mentioned: boolean;
  cited: boolean;
  rank: number | null;
  competitors: string[];
  answer: string;
  prompt: { text: string; locale: string; productId: string | null };
};

export function groupByProduct(
  rows: ResultRow[],
  products: { id: string; title: string; url: string | null; priceCents: number | null; currency: string | null }[],
  brandLabels: string[],
): ProductVisibility[] {
  const byProduct = new Map<string, ProductAnswer[]>();
  for (const row of rows) {
    if (!row.prompt.productId) continue;
    const answer: ProductAnswer = {
      provider: row.provider,
      model: row.model,
      locale: row.prompt.locale,
      question: row.prompt.text,
      shown: row.mentioned,
      cited: row.cited,
      rank: row.rank,
      winner: row.competitors[0] ?? null,
      competitors: row.competitors.slice(0, 5),
      evidence: evidenceFor(row.answer, row.mentioned ? brandLabels : row.competitors),
    };
    const list = byProduct.get(row.prompt.productId);
    if (list) list.push(answer);
    else byProduct.set(row.prompt.productId, [answer]);
  }

  return products
    .map((product) => {
      const answers = byProduct.get(product.id) ?? [];
      const counts = new Map<string, number>();
      for (const answer of answers) {
        for (const host of new Set(answer.competitors)) counts.set(host, (counts.get(host) ?? 0) + 1);
      }
      const ranks = answers
        .filter((answer) => answer.shown)
        .map((answer) => answer.rank)
        .filter((rank): rank is number => rank !== null);

      return {
        productId: product.id,
        title: product.title,
        url: product.url,
        priceCents: product.priceCents,
        currency: product.currency,
        answers,
        shown: answers.filter((answer) => answer.shown).length,
        asked: answers.length,
        bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
        rivals: [...counts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 3)
          .map(([host, count]) => ({ host, answers: count })),
        advice: adviceFor(answers),
      };
    })
    // Silent products first: they are what the merchant is paying to find out.
    .sort((a, b) => a.shown / (a.asked || 1) - b.shown / (b.asked || 1) || b.asked - a.asked);
}

/** Per-product overview of the latest completed run, built from the stored answers. */
export async function productVisibility(brandId: string, limit = 40): Promise<ProductVisibility[]> {
  const run = await prisma.visibilityRun.findFirst({
    where: { brandId, status: "complete" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!run) return [];

  const rows = await prisma.visibilityResult.findMany({
    where: { runId: run.id, error: null },
    orderBy: { createdAt: "asc" },
    select: {
      provider: true,
      model: true,
      mentioned: true,
      cited: true,
      rank: true,
      competitors: true,
      answer: true,
      prompt: { select: { text: true, locale: true, productId: true } },
    },
  });

  const productIds = [...new Set(rows.map((row) => row.prompt.productId).filter((id): id is string => Boolean(id)))];
  const [products, brand] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, url: true, priceCents: true, currency: true },
    }),
    prisma.brand.findUnique({ where: { id: brandId }, select: { name: true, domain: true } }),
  ]);

  const labels = brand ? [brand.name, brand.domain.replace(/^www\./, "")] : [];
  return groupByProduct(rows, products, labels).slice(0, limit);
}
