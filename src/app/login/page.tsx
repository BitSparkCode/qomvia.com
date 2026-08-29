import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { MONITOR_PRICE_CHF } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Qomvia account to re-scan your store and track AI visibility.",
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-muted">
        We email you a one-time link — no password to remember or leak. Use the address you paid with and your store is
        already attached to the account.
      </p>
      <LoginForm />
      <p className="text-sm text-muted">
        No account yet? Re-scans, product import and AI visibility monitoring are part of the paid plans, from CHF{" "}
        {MONITOR_PRICE_CHF}/month —{" "}
        <Link href="/pricing" className="text-accent">
          see pricing
        </Link>
        .
      </p>
    </div>
  );
}
