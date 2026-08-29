import Link from "next/link";
import { NAV_GROUPS } from "@/lib/nav";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-rule bg-raised">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="hidden gap-10 sm:grid sm:grid-cols-4">
          <p className="text-xs leading-relaxed text-muted">
            {SITE_NAME} — independent measurement of agent readiness. Scores are computed from public HTTP responses.
          </p>
          {NAV_GROUPS.map((group) => (
            <nav key={group.label}>
              <p className="eyebrow">{group.label}</p>
              <ul className="mt-3 space-y-2 text-xs text-muted">
                {group.links.map((link) => (
                  <li key={`${group.label}-${link.href}-${link.label}`}>
                    <Link href={link.href} className="hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Small screens collapse each column into a disclosure. */}
        <div className="sm:hidden">
          <p className="text-xs leading-relaxed text-muted">
            {SITE_NAME} — independent measurement of agent readiness. Scores are computed from public HTTP responses.
          </p>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {NAV_GROUPS.map((group) => (
              <details key={group.label} className="py-3">
                <summary className="eyebrow cursor-pointer list-none">{group.label}</summary>
                <ul className="mt-2 space-y-2 text-xs text-muted">
                  {group.links.map((link) => (
                    <li key={`${group.label}-${link.href}-${link.label}`}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
