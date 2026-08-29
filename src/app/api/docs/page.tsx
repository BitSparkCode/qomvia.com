import type { Metadata } from "next";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "API",
  description: "Score any storefront and read published agent-readiness scores as JSON.",
  alternates: { canonical: absoluteUrl("/api/docs") },
};

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/scan",
    body: '{ "domain": "example.com" }',
    description:
      "Runs a public scan (about 20 read-only requests) and returns the score. Cached for one hour per domain.",
  },
  {
    method: "GET",
    path: "/api/score/<slug>",
    description: "Returns the latest published score for a store, including every signal and its evidence.",
  },
  {
    method: "GET",
    path: "/badge/<slug>.svg",
    description: "Live SVG badge for embedding. Updates automatically on every re-scan.",
  },
  {
    method: "GET",
    path: "/llms.txt",
    description: "Machine-readable description of this service for AI agents.",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">API</h1>
        <p className="text-muted">
          Public, unauthenticated and rate-limited. {SITE_NAME} is meant to be quoted by other agents, so the data is
          free to read.
        </p>
      </header>

      <ul className="space-y-4">
        {ENDPOINTS.map((endpoint) => (
          <li key={endpoint.path} className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3 font-mono text-sm">
              <span className="rounded border border-border px-2 py-0.5 text-xs text-accent">{endpoint.method}</span>
              {endpoint.path}
            </div>
            <p className="text-sm text-muted">{endpoint.description}</p>
            {endpoint.body ? (
              <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">
                <code>{endpoint.body}</code>
              </pre>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="font-semibold">Example</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs">
          <code>{`curl -s -X POST ${absoluteUrl("/api/scan")} \\\n  -H 'content-type: application/json' \\\n  -d '{"domain":"example.com"}'`}</code>
        </pre>
      </section>
    </div>
  );
}
