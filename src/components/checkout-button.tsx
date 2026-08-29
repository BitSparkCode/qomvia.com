"use client";

import { useState } from "react";
import { MONITOR_PRICE_CHF } from "@/lib/site";

export function CheckoutButton({
  domain,
  product = "monitor",
  label = `Start visibility monitoring — CHF ${MONITOR_PRICE_CHF}/mo`,
}: {
  domain: string;
  product?: "monitor" | "agency" | "pack_1000" | "pack_5000";
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
      <button type="button" onClick={start} disabled={state === "loading"} className="btn">
        {state === "loading" ? "Opening checkout…" : label}
      </button>
      {message ? <span className="max-w-xs text-xs text-warn">{message}</span> : null}
    </span>
  );
}
