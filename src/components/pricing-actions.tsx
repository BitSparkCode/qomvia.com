"use client";

import Link from "next/link";
import { useState } from "react";

export function PricingActions({ product }: { product: "deep_audit" | "monitor" | "agency" | null }) {
  const [domain, setDomain] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!product) {
    return (
      <Link href="/" className="block rounded-lg border border-border px-4 py-2 text-center text-sm">
        Scan a store
      </Link>
    );
  }

  async function start() {
    if (!domain.trim()) {
      setMessage("Enter the domain this applies to.");
      return;
    }
    setLoading(true);
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
      setMessage(payload.error ?? "Could not start checkout.");
    } catch {
      setMessage("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={domain}
        onChange={(event) => setDomain(event.target.value)}
        placeholder="yourstore.com"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
      >
        {loading ? "Opening checkout…" : "Buy"}
      </button>
      {message ? <p className="text-xs text-warn">{message}</p> : null}
    </div>
  );
}
