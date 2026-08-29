"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { grantCreditsAction, setSubscriptionAction } from "@/app/admin/actions";
import type { FormState } from "@/app/auth-actions";

function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary">
      {pending ? busy : idle}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="mt-1 text-xs text-bad">{state.error}</p>;
  if (state.ok) return <p className="mt-1 text-xs text-accent">{state.ok}</p>;
  return null;
}

export function PlanOverride({
  brandId,
  userId,
  email,
  tier,
}: {
  brandId: string;
  userId: string;
  email: string;
  tier: "MONITOR" | "AGENCY" | "none";
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setSubscriptionAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="userId" value={userId} />
      <select
        name="tier"
        defaultValue={tier}
        className="border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="none">No plan</option>
        <option value="MONITOR">Monitor</option>
        <option value="AGENCY">Agency</option>
      </select>
      <Submit idle="Apply" busy="Saving…" />
      <Feedback state={state} />
    </form>
  );
}

export function CreditGrant({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(grantCreditsAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      <input
        type="number"
        name="credits"
        min={1}
        max={100000}
        placeholder="500"
        className="w-24 border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <Submit idle="Add credits" busy="Adding…" />
      <Feedback state={state} />
    </form>
  );
}
