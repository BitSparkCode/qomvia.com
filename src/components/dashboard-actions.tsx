"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addCompetitorAction,
  importProductsAction,
  removeCompetitorAction,
  logoutAction,
  rescanAction,
  runVisibilityAction,
  trackProductsAction,
  type FormState,
} from "@/app/auth-actions";

export type WatchlistProduct = { id: string; title: string; priceCents: number | null; currency: string | null; tracked: boolean };

function Submit({ idle, busy, variant = "accent" }: { idle: string; busy: string; variant?: "accent" | "outline" }) {
  const { pending } = useFormStatus();
  const className = variant === "accent" ? "btn" : "btn-secondary";
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : idle}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="mt-2 text-sm text-bad">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-sm text-accent">{state.ok}</p>;
  return null;
}

export function RescanButton({ brandId, disabled }: { brandId: string; disabled?: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(rescanAction, {});
  if (disabled) {
    return (
      <p className="text-sm text-muted">
        Re-scanning is included in the paid plans — upgrade to re-check this store on demand.
      </p>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="brandId" value={brandId} />
      <Submit idle="Re-scan now" busy="Scanning…" />
      <Feedback state={state} />
    </form>
  );
}

export function VisibilityRunButton({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(runVisibilityAction, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="brandId" value={brandId} />
      <Submit idle="Run LLM visibility check" busy="Asking the models…" />
      <Feedback state={state} />
    </form>
  );
}

export function Watchlist({
  brandId,
  products,
  creditsPerProduct,
}: {
  brandId: string;
  products: WatchlistProduct[];
  creditsPerProduct: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(trackProductsAction, {});
  const [selected, setSelected] = useState(() => new Set(products.filter((p) => p.tracked).map((p) => p.id)));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const effective = selected.size === 0 ? products.length : selected.size;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="mode" value="selection" />
      <p className="text-sm text-muted">
        {selected.size === 0
          ? "Nothing selected — every imported product is asked about."
          : `${selected.size} of ${products.length} products tracked.`}{" "}
        Next run costs about {effective * creditsPerProduct} credits.
      </p>
      <div className="max-h-64 divide-y divide-border overflow-y-auto border border-border">
        {products.map((product) => (
          <label key={product.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="productId"
              value={product.id}
              checked={selected.has(product.id)}
              onChange={() => toggle(product.id)}
            />
            <span className="flex-1 truncate">{product.title}</span>
            {product.priceCents == null ? null : (
              <span className="tabular text-xs text-muted">
                {(product.priceCents / 100).toFixed(0)} {product.currency ?? ""}
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Submit idle="Save watchlist" busy="Saving…" variant="outline" />
        <button type="submit" name="mode" value="topByPrice" className="text-sm text-muted hover:text-foreground">
          Track top 50 by price
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export type TrackedCompetitor = {
  id: string;
  name: string;
  domain: string | null;
  mentions: number;
  wins: number;
};

export function CompetitorTracker({
  brandId,
  competitors,
  allowance,
}: {
  brandId: string;
  competitors: TrackedCompetitor[];
  allowance: number;
}) {
  const [addState, addAction] = useActionState<FormState, FormData>(addCompetitorAction, {});
  const [removeState, removeAction] = useActionState<FormState, FormData>(removeCompetitorAction, {});
  const full = competitors.length >= allowance;

  return (
    <div className="space-y-3">
      {competitors.length > 0 ? (
        <ul className="divide-y divide-border border border-border">
          {competitors.map((competitor) => (
            <li key={competitor.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate">{competitor.domain ?? competitor.name}</span>
              <span className="tabular text-xs text-muted">
                named in {competitor.mentions} answers · {competitor.wins} without you
              </span>
              <form action={removeAction}>
                <input type="hidden" name="brandId" value={brandId} />
                <input type="hidden" name="competitorId" value={competitor.id} />
                <button type="submit" className="text-xs text-muted hover:text-foreground">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={addAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="brandId" value={brandId} />
        <input
          name="domain"
          placeholder="competitor.ch"
          disabled={full}
          className="flex-1 border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <Submit idle="Watch competitor" busy="Adding…" variant="outline" />
      </form>
      <p className="text-xs text-muted">
        {competitors.length} of {allowance} slots used. Every run reports where each watched domain is recommended
        instead of you.
      </p>
      <Feedback state={addState} />
      <Feedback state={removeState} />
    </div>
  );
}

export function ImportForm({ brandId, domain }: { brandId: string; domain: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(importProductsAction, {});
  const [source, setSource] = useState("shopify");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { id: "shopify", label: "Shopify" },
          { id: "feed", label: "Feed URL" },
          { id: "csv", label: "CSV paste" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSource(option.id)}
            className={`border px-3 py-1.5 ${
              source === option.id ? "border-accent text-accent" : "border-border text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="source" value={source} />

      {source === "csv" ? (
        <textarea
          name="csv"
          rows={6}
          placeholder="id,title,category,price,currency,link&#10;SKU-1,Merino Runner,Shoes,189.00,CHF,https://…"
          className="w-full border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
      ) : (
        <input
          name="value"
          defaultValue={source === "shopify" ? domain : ""}
          placeholder={source === "shopify" ? domain : "https://yourstore.com/feed.xml"}
          className="w-full border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      <p className="text-xs text-muted">
        {source === "shopify"
          ? "Reads the public /products.json of your Shopify storefront. No app install, no credentials."
          : source === "feed"
            ? "Google Merchant XML, RSS product feeds and JSON catalogues are supported."
            : "First row is the header. Recognised columns: id, title, description, category, price, currency, gtin, link, image."}
      </p>
      <Submit idle="Import products" busy="Importing…" variant="outline" />
      <Feedback state={state} />
    </form>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-muted hover:text-foreground">
        Sign out
      </button>
    </form>
  );
}
