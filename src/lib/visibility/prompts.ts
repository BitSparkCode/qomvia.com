import type { ParsedProduct } from "@/lib/products/parse";

export type PromptIntent = "category" | "product" | "comparison" | "brand";

export type GeneratedPrompt = {
  text: string;
  intent: PromptIntent;
  externalId?: string;
};

export type PromptInput = {
  brandName: string;
  domain: string;
  locale: string;
  products: (Pick<ParsedProduct, "title" | "category" | "vendor" | "priceCents" | "currency"> & {
    externalId?: string;
  })[];
};

type Phrasing = {
  category: (category: string, region: string) => string[];
  product: (title: string) => string[];
  comparison: (brand: string, category: string) => string[];
  brand: (brand: string, domain: string) => string[];
};

const PHRASINGS: Record<string, Phrasing> = {
  de: {
    category: (category, region) => [
      `Welcher Onlineshop ${region} hat die beste Auswahl an ${category}?`,
      `Wo kann ich ${category} online kaufen?`,
      `Beste ${category} 2026 – welche Marke empfiehlst du?`,
    ],
    product: (title) => [`Wo kann ich ${title} online kaufen?`, `Ist ${title} empfehlenswert?`],
    comparison: (brand, category) => [`${brand} oder Alternativen für ${category} – was ist besser?`],
    brand: (brand, domain) => [
      `Ist ${brand} (${domain}) ein seriöser Onlineshop?`,
      `Was verkauft ${brand} und für wen ist es geeignet?`,
    ],
  },
  en: {
    category: (category, region) => [
      `Which online shop ${region} has the best selection of ${category}?`,
      `Where can I buy ${category} online?`,
      `Best ${category} in 2026 — which brand do you recommend?`,
    ],
    product: (title) => [`Where can I buy ${title} online?`, `Is ${title} worth buying?`],
    comparison: (brand, category) => [`${brand} vs. alternatives for ${category} — which is better?`],
    brand: (brand, domain) => [
      `Is ${brand} (${domain}) a trustworthy online shop?`,
      `What does ${brand} sell and who is it for?`,
    ],
  },
};

const REGIONS: Record<string, { de: string; en: string }> = {
  CH: { de: "in der Schweiz", en: "in Switzerland" },
  DE: { de: "in Deutschland", en: "in Germany" },
  AT: { de: "in Österreich", en: "in Austria" },
};

function localeParts(locale: string): { language: "de" | "en"; country: string } {
  const [language, country] = locale.split("-");
  return { language: language === "de" ? "de" : "en", country: (country ?? "CH").toUpperCase() };
}

/** The categories worth spending prompt budget on: the most frequent ones. */
export function topCategories(products: PromptInput["products"], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const raw of (product.category ?? "").split(/[>|/,]/)) {
      const category = raw.trim().toLowerCase();
      if (category.length < 3 || category.length > 60) continue;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([category]) => category);
}

/**
 * Turns a catalogue into the phrase set we ask the models every cycle: category
 * demand ("where can I buy X"), the highest-value individual products, one
 * comparison phrase per top category and the brand-trust questions. Capped by
 * `budget`, because every prompt costs money on every provider, every run.
 */
export function generatePrompts(input: PromptInput, budget: number): GeneratedPrompt[] {
  const { language, country } = localeParts(input.locale);
  const phrasing = PHRASINGS[language];
  const region = REGIONS[country]?.[language] ?? (language === "de" ? "in Europa" : "in Europe");

  const prompts: GeneratedPrompt[] = [];
  const seen = new Set<string>();
  const push = (text: string, intent: PromptIntent, externalId?: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    const key = normalized.toLowerCase();
    if (normalized.length === 0 || seen.has(key)) return;
    seen.add(key);
    prompts.push({ text: normalized, intent, externalId });
  };

  for (const text of phrasing.brand(input.brandName, input.domain)) push(text, "brand");

  const categories = topCategories(input.products, 12);
  for (const category of categories) {
    for (const text of phrasing.category(category, region)) push(text, "category");
  }

  const flagships = [...input.products]
    .sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0))
    .slice(0, 40);
  for (const product of flagships) {
    for (const text of phrasing.product(product.title)) push(text, "product", product.externalId);
  }

  for (const category of categories.slice(0, 6)) {
    for (const text of phrasing.comparison(input.brandName, category)) push(text, "comparison");
  }

  return prompts.slice(0, budget);
}
