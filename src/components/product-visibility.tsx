import { answerVerdict, type ProductVisibility } from "@/lib/visibility/overview";

function Pill({ shown }: { shown: boolean }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
        shown ? "bg-accent/10 text-accent" : "bg-bad/10 text-bad"
      }`}
    >
      {shown ? "shown" : "not shown"}
    </span>
  );
}

function price(product: ProductVisibility): string | null {
  if (product.priceCents == null) return null;
  return `${(product.priceCents / 100).toFixed(2)} ${product.currency ?? ""}`.trim();
}

/**
 * One product, one block: the headline verdict, a row per model and locale with
 * the answer it was read from, and what to change. Used for both the paid
 * dashboard view and the public sample, so the sample is never a mock-up.
 */
export function ProductVisibilityList({
  products,
  redactEvidence = false,
}: {
  products: ProductVisibility[];
  redactEvidence?: boolean;
}) {
  if (products.length === 0) {
    return <p className="text-sm text-muted">No answers yet. Run a check to see which products the models name.</p>;
  }

  return (
    <ul className="space-y-6">
      {products.map((product) => (
        <li key={product.productId} className="border border-border bg-background p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">{product.title}</h4>
            <p className="text-xs text-muted">
              {price(product) ? `${price(product)} · ` : ""}shown in {product.shown} of {product.asked} answers
              {product.bestRank ? ` · best position ${product.bestRank}` : ""}
            </p>
          </div>

          {product.rivals.length > 0 ? (
            <p className="mt-1 text-xs text-muted">
              Recommended instead: {product.rivals.map((rival) => `${rival.host} (${rival.answers})`).join(", ")}
            </p>
          ) : null}

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-1 font-normal">Model</th>
                <th className="py-1 font-normal">Market</th>
                <th className="py-1 font-normal">Question</th>
                <th className="py-1 font-normal">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {product.answers.map((answer, index) => (
                <tr key={`${answer.model}-${answer.locale}-${index}`} className="border-b border-border align-top last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{answer.model}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{answer.locale}</td>
                  <td className="py-2 pr-3 text-muted">{answer.question}</td>
                  <td className="py-2">
                    <Pill shown={answer.shown} /> <span className="text-muted">{answerVerdict(answer)}</span>
                    {redactEvidence ? null : (
                      <p className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted">
                        “{answer.evidence}”
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 border-l-2 border-accent pl-3 text-sm">{product.advice}</p>
        </li>
      ))}
    </ul>
  );
}
