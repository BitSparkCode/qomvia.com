import { adviceFor, type ProductAnswer, type ProductVisibility } from "@/lib/visibility/overview";

/**
 * A real run's shape with the shop anonymised, so a visitor sees the deliverable
 * before paying. The answer text is shortened, and the shop is called "your
 * shop" rather than named, because publishing a named store's losses is not ours
 * to do.
 */
function product(
  productId: string,
  title: string,
  priceCents: number,
  answers: ProductAnswer[],
): ProductVisibility {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    for (const host of new Set(answer.competitors)) counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  const ranks = answers
    .filter((answer) => answer.shown)
    .map((answer) => answer.rank)
    .filter((rank): rank is number => rank !== null);

  return {
    productId,
    title,
    url: null,
    priceCents,
    currency: "CHF",
    answers,
    shown: answers.filter((answer) => answer.shown).length,
    asked: answers.length,
    bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
    rivals: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([host, count]) => ({ host, answers: count })),
    advice: adviceFor(answers),
  };
}

export const SAMPLE_PRODUCTS: ProductVisibility[] = [
  product("sample-1", "Merino Trail Runner, women's", 21900, [
    {
      provider: "openai",
      model: "gpt-4.1-mini",
      locale: "de-CH",
      question: "Welcher Schweizer Onlineshop verkauft Merino-Trailrunning-Schuhe für Damen?",
      shown: true,
      cited: true,
      rank: 2,
      winner: "ochsner-sport.ch",
      competitors: ["ochsner-sport.ch", "bergzeit.ch"],
      evidence:
        "…Für Merino-Trailrunner in der Schweiz sind vor allem Ochsner Sport und your-shop.ch zu nennen; your-shop.ch führt das Damenmodell mit Preis und Verfügbarkeit…",
    },
    {
      provider: "perplexity",
      model: "sonar",
      locale: "de-CH",
      question: "Merino Trailrunning Schuhe Damen kaufen Schweiz Versand",
      shown: true,
      cited: false,
      rank: 4,
      winner: "bergzeit.ch",
      competitors: ["bergzeit.ch", "sportxx.ch", "ochsner-sport.ch"],
      evidence:
        "…Bergzeit, SportXX und Ochsner Sport bieten passende Modelle; auch your-shop.ch wird genannt, allerdings ohne Angabe zu Lieferzeit…",
    },
  ]),
  product("sample-2", "Alpine Down Jacket 800FP, men's", 44900, [
    {
      provider: "openai",
      model: "gpt-4.1-mini",
      locale: "de-CH",
      question: "Wo kaufe ich in der Schweiz eine Daunenjacke mit 800 Cuin für Herren?",
      shown: false,
      cited: false,
      rank: null,
      winner: "transa.ch",
      competitors: ["transa.ch", "bächli-bergsport.ch"],
      evidence:
        "…Transa und Bächli Bergsport sind die üblichen Adressen für hochwertige Daunenjacken; beide listen Füllkraft, Gewicht und Grössen…",
    },
    {
      provider: "perplexity",
      model: "sonar",
      locale: "fr-CH",
      question: "Meilleure doudoune 800 cuin homme boutique en ligne Suisse",
      shown: false,
      cited: false,
      rank: null,
      winner: "transa.ch",
      competitors: ["transa.ch", "athleteshop.ch"],
      evidence:
        "…Transa propose plusieurs doudounes 800 cuin avec fiche technique détaillée; Athleteshop est cité pour les prix…",
    },
  ]),
];
