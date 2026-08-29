import type { ParsedProduct } from "@/lib/products/parse";

export type PromptIntent = "category" | "product" | "comparison" | "brand";

export type GeneratedPrompt = {
  text: string;
  intent: PromptIntent;
  locale: string;
  externalId?: string;
};

export type PromptInput = {
  brandName: string;
  domain: string;
  /** Every locale the phrase set is asked in, primary market first. */
  locales: string[];
  products: (Pick<ParsedProduct, "title" | "category" | "vendor" | "priceCents" | "currency"> & {
    externalId?: string;
  })[];
};

type Language = "de" | "en" | "fr";

type Phrasing = {
  category: (category: string, region: string) => string[];
  /** One phrase per catalogue item, plus deeper variants for flagships. */
  product: (title: string, region: string) => string[];
  productDeep: (title: string, priceHint: string | null) => string[];
  comparison: (brand: string, category: string, region: string) => string[];
  brand: (brand: string, domain: string, region: string) => string[];
};

const PHRASINGS: Record<Language, Phrasing> = {
  de: {
    category: (category, region) => [
      `Welcher Onlineshop ${region} hat die beste Auswahl an ${category}?`,
      `Wo kaufe ich ${category} ${region} am besten online?`,
      `Beste ${category} – welche Marke und welcher Shop sind empfehlenswert?`,
    ],
    product: (title, region) => [`Wo kann ich ${title} ${region} online kaufen?`],
    productDeep: (title, priceHint) => [
      `Ist ${title} empfehlenswert und welcher Shop hat es auf Lager?`,
      priceHint ? `${title} – wo ist der Preis ${priceHint} fair und wer liefert schnell?` : `Gibt es gute Alternativen zu ${title}?`,
    ],
    comparison: (brand, category, region) => [
      `${brand} oder Alternativen für ${category} – welcher Shop ${region} ist besser?`,
      `Welche Shops ${region} sind die grössten Konkurrenten von ${brand} bei ${category}?`,
    ],
    brand: (brand, domain, region) => [
      `Ist ${brand} (${domain}) ein seriöser Onlineshop ${region}?`,
      `Was verkauft ${brand} und für wen ist es geeignet?`,
    ],
  },
  en: {
    category: (category, region) => [
      `Which online shop ${region} has the best selection of ${category}?`,
      `Where should I buy ${category} online ${region}?`,
      `Best ${category} — which brand and which retailer do you recommend?`,
    ],
    product: (title, region) => [`Where can I buy ${title} online ${region}?`],
    productDeep: (title, priceHint) => [
      `Is ${title} worth buying, and which shop has it in stock?`,
      priceHint ? `${title} — is ${priceHint} a fair price and who ships fastest?` : `What are good alternatives to ${title}?`,
    ],
    comparison: (brand, category, region) => [
      `${brand} vs. the alternatives for ${category} ${region} — which retailer is better?`,
      `Which shops ${region} compete with ${brand} on ${category}?`,
    ],
    brand: (brand, domain, region) => [
      `Is ${brand} (${domain}) a trustworthy online shop ${region}?`,
      `What does ${brand} sell and who is it for?`,
    ],
  },
  fr: {
    category: (category, region) => [
      `Quelle boutique en ligne ${region} a le meilleur choix de ${category} ?`,
      `Où acheter ${category} en ligne ${region} ?`,
      `Meilleurs ${category} — quelle marque et quel site recommandez-vous ?`,
    ],
    product: (title, region) => [`Où acheter ${title} en ligne ${region} ?`],
    productDeep: (title, priceHint) => [
      `Est-ce que ${title} vaut la peine, et quelle boutique l'a en stock ?`,
      priceHint ? `${title} — le prix ${priceHint} est-il correct et qui livre le plus vite ?` : `Quelles sont les bonnes alternatives à ${title} ?`,
    ],
    comparison: (brand, category, region) => [
      `${brand} ou ses alternatives pour ${category} ${region} — quelle boutique est meilleure ?`,
      `Quelles boutiques ${region} concurrencent ${brand} sur ${category} ?`,
    ],
    brand: (brand, domain, region) => [
      `${brand} (${domain}) est-elle une boutique en ligne fiable ${region} ?`,
      `Que vend ${brand} et à qui cela s'adresse-t-il ?`,
    ],
  },
};

const REGIONS: Record<string, Record<Language, string>> = {
  CH: { de: "in der Schweiz", en: "in Switzerland", fr: "en Suisse" },
  DE: { de: "in Deutschland", en: "in Germany", fr: "en Allemagne" },
  AT: { de: "in Österreich", en: "in Austria", fr: "en Autriche" },
  FR: { de: "in Frankreich", en: "in France", fr: "en France" },
};

/**
 * Which markets a shop is asked about: its own first, then the neighbouring
 * language markets, because "invisible in Germany" is a different finding from
 * "invisible at home". Bounded by the plan, since every locale re-asks every phrase.
 */
export function localesForCountry(country: string | null | undefined, count: number): string[] {
  const primary = (country ?? "CH").toUpperCase();
  const byCountry: Record<string, string[]> = {
    CH: ["de-CH", "en-CH", "fr-CH", "de-DE"],
    DE: ["de-DE", "en-DE", "de-AT", "de-CH"],
    AT: ["de-AT", "en-AT", "de-DE"],
    FR: ["fr-FR", "en-FR", "fr-CH"],
  };
  const list = byCountry[primary] ?? [`en-${primary}`, "en-US", "de-DE"];
  return list.slice(0, Math.max(1, count));
}

function localeParts(locale: string): { language: Language; country: string } {
  const [rawLanguage, rawCountry] = locale.split("-");
  const language: Language = rawLanguage === "de" ? "de" : rawLanguage === "fr" ? "fr" : "en";
  return { language, country: (rawCountry ?? "CH").toUpperCase() };
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

function priceHint(product: PromptInput["products"][number]): string | null {
  if (!product.priceCents) return null;
  return `${Math.round(product.priceCents / 100)} ${product.currency ?? "CHF"}`;
}

/**
 * Turns a catalogue into the phrase set the models are asked. Every product gets
 * at least one purchase-intent phrase per locale so the whole catalogue is
 * covered over successive runs; flagships, categories, competitor comparisons and
 * brand-trust questions add the phrases that reveal *who* wins the answer instead.
 * `limit` caps the stored set, not one run — a run draws its plan budget from it.
 */
export function generatePrompts(input: PromptInput, limit: number): GeneratedPrompt[] {
  const prompts: GeneratedPrompt[] = [];
  const seen = new Set<string>();
  const push = (text: string, intent: PromptIntent, locale: string, externalId?: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    const key = `${locale}|${normalized.toLowerCase()}`;
    if (normalized.length === 0 || seen.has(key)) return;
    seen.add(key);
    prompts.push({ text: normalized, intent, locale, externalId });
  };

  const categories = topCategories(input.products, 12);
  const byValue = [...input.products].sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0));
  const flagships = byValue.slice(0, 40);

  for (const locale of input.locales) {
    const { language, country } = localeParts(locale);
    const phrasing = PHRASINGS[language];
    const region = REGIONS[country]?.[language] ?? (language === "de" ? "in Europa" : language === "fr" ? "en Europe" : "in Europe");

    for (const text of phrasing.brand(input.brandName, input.domain, region)) push(text, "brand", locale);
    for (const category of categories) {
      for (const text of phrasing.category(category, region)) push(text, "category", locale);
    }
    for (const category of categories.slice(0, 6)) {
      for (const text of phrasing.comparison(input.brandName, category, region)) push(text, "comparison", locale);
    }
    for (const product of flagships) {
      for (const text of phrasing.productDeep(product.title, priceHint(product))) {
        push(text, "product", locale, product.externalId);
      }
    }
    // The long tail: one phrase per remaining catalogue item, so coverage is total.
    for (const product of byValue) {
      for (const text of phrasing.product(product.title, region)) {
        push(text, "product", locale, product.externalId);
      }
    }
  }

  return prompts.slice(0, Math.max(0, limit));
}
