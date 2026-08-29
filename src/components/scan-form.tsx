"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { scanAction, type ScanFormState } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-3 font-semibold text-black transition disabled:opacity-60"
    >
      {pending ? "Scanning…" : "Check my store"}
    </button>
  );
}

export function ScanForm({ defaultValue = "" }: { defaultValue?: string }) {
  const [state, formAction] = useActionState<ScanFormState, FormData>(scanAction, {});
  return (
    <form action={formAction} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="domain"
          defaultValue={defaultValue}
          placeholder="yourstore.com"
          autoComplete="url"
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 outline-none placeholder:text-muted focus:border-accent"
        />
        <SubmitButton />
      </div>
      <p className="mt-2 text-xs text-muted">
        A scan takes about 15 seconds and makes roughly 20 read-only requests. We never submit forms or attempt a
        purchase.
      </p>
      {state.error ? <p className="mt-2 text-sm text-bad">{state.error}</p> : null}
    </form>
  );
}
