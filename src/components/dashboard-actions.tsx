"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  importProductsAction,
  logoutAction,
  rescanAction,
  runVisibilityAction,
  type FormState,
} from "@/app/auth-actions";

function Submit({ idle, busy, variant = "accent" }: { idle: string; busy: string; variant?: "accent" | "outline" }) {
  const { pending } = useFormStatus();
  const className =
    variant === "accent"
      ? "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition disabled:opacity-60"
      : "rounded-lg border border-border px-4 py-2 text-sm transition disabled:opacity-60";
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
            className={`rounded-lg border px-3 py-1.5 ${
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
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
      ) : (
        <input
          name="value"
          defaultValue={source === "shopify" ? domain : ""}
          placeholder={source === "shopify" ? domain : "https://yourstore.com/feed.xml"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
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
