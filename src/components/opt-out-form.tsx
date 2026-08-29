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
      className="border border-border px-4 py-2 text-sm disabled:opacity-60"
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
        className="input"
      />
      <input
        name="email"
        type="email"
        placeholder="you@yourstore.com"
        className="input"
      />
      <SubmitButton />
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-accent">{state.ok}</p> : null}
    </form>
  );
}
