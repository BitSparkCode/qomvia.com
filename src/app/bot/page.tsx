import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About AgentCommerceBot",
  description:
    "What AgentCommerceBot is, what it requests, how to rate-limit it and how to block it. Published for site operators and security teams.",
  alternates: { canonical: absoluteUrl("/bot") },
};

export default function BotPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">AgentCommerceBot</h1>
      <p className="text-muted">
        AgentCommerceBot is the crawler behind {SITE_NAME}. It measures whether AI shopping agents can read and transact
        against a storefront, and publishes the result on a public score page.
      </p>

      <section className="space-y-2">
        <h2 className="font-semibold">User agent</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs">
          <code>AgentCommerceBot/1.0 (+https://agent-commerce.io/bot; readiness measurement; respects robots.txt)</code>
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">What it does</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Requests robots.txt, the homepage, one category page, one product page and a cart URL.</li>
          <li>Probes a fixed list of well-known files: llms.txt, /.well-known/mcp.json, security.txt, openapi.json and similar.</li>
          <li>Requests your sitemap and, if present, a product feed.</li>
          <li>Roughly 20 GET requests per public scan, one request at a time per host.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">What it never does</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Submit a form, add to a cart or attempt a purchase.</li>
          <li>Log in, create an account or use credentials.</li>
          <li>Solve or circumvent a CAPTCHA, or spoof a browser to evade bot management when identifying as our crawler.</li>
          <li>Crawl paths disallowed for it in robots.txt.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">How to control it</h2>
        <p className="text-sm text-muted">Slow it down or block it in robots.txt:</p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs">
          <code>{`User-agent: AgentCommerceBot\nCrawl-delay: 10\nDisallow: /checkout`}</code>
        </pre>
        <p className="text-sm text-muted">
          To remove an existing public score page as well, use the{" "}
          <Link href="/opt-out" className="text-accent">
            opt-out form
          </Link>
          . Questions: bot@agent-commerce.io.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">A note on comparing user agents</h2>
        <p className="text-sm text-muted">
          One signal compares the HTML served to our declared crawler with the HTML served to a common browser user agent,
          because that difference is exactly what breaks AI agents. Both requests are plain GETs of the same public
          homepage, and no attempt is made to look like a real browser session.
        </p>
      </section>
    </div>
  );
}
