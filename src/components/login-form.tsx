"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestLoginAction, type FormState } from "@/app/auth-actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-3 font-semibold text-black transition disabled:opacity-60"
    >
      {pending ? "Sending…" : label}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(requestLoginAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <input
        name="email"
        type="email"
        required
        placeholder="you@yourstore.com"
        autoComplete="email"
        className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none placeholder:text-muted focus:border-accent"
      />
      <Submit label="Email me a sign-in link" />
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-accent">{state.ok}</p> : null}
    </form>
  );
}
