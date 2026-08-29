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
      className="btn"
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
          className="input flex-1"
        />
        <SubmitButton />
      </div>
      {state.error ? <p className="mt-2 text-sm text-bad">{state.error}</p> : null}
    </form>
  );
}
