"use client";

import { useState } from "react";
import { DEEP_AUDIT_PRICE_CHF } from "@/lib/site";

export function DeepAuditButton({
  domain,
  product = "deep_audit",
  label = `Get the deep audit — CHF ${DEEP_AUDIT_PRICE_CHF}`,
}: {
  domain: string;
  product?: "deep_audit" | "monitor" | "agency";
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function start() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, product }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      setState("error");
      setMessage(payload.error ?? "Could not start checkout.");
    } catch {
      setState("error");
      setMessage("Could not start checkout.");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={start}
        disabled={state === "loading"}
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-black disabled:opacity-60"
      >
        {state === "loading" ? "Opening checkout…" : label}
      </button>
      {message ? <span className="max-w-xs text-xs text-warn">{message}</span> : null}
    </span>
  );
}
