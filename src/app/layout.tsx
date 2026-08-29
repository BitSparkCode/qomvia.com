import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Qomvia measures whether AI shopping agents can discover, read and check out on your storefront, and publishes a transparent 100-point score.",
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

const NAV = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/methodology", label: "Methodology" },
  { href: "/pricing", label: "Pricing" },
  { href: "/report", label: "State of agent commerce" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent font-mono text-sm text-black">
                ✓
              </span>
              {SITE_NAME}
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-sm text-muted">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted">
            <span>
              {SITE_NAME} — independent measurement of agent readiness. Scores are computed from public HTTP responses.
            </span>
            <span className="flex gap-4">
              <Link href="/bot">About our crawler</Link>
              <Link href="/opt-out">Opt out</Link>
              <Link href="/api/docs">API</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
