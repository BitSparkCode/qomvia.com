"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { optOutAction, type ScanFormState } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Opt out"}
    </button>
  );
}

export function OptOutForm() {
  const [state, formAction] = useActionState<ScanFormState, FormData>(optOutAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input
        name="domain"
        placeholder="yourstore.com"
        className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <input
        name="email"
        type="email"
        placeholder="you@yourstore.com"
        className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <SubmitButton />
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-accent">{state.ok}</p> : null}
    </form>
  );
}
