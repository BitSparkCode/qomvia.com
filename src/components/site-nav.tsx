"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_DIRECT, NAV_GROUPS } from "@/lib/nav";
import { useSignedIn } from "@/lib/use-signed-in";

export function SiteNav() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const [shownPath, setShownPath] = useState(pathname);
  const signedIn = useSignedIn();
  const account = signedIn ? { href: "/dashboard", label: "Dashboard" } : { href: "/login", label: "Sign in" };

  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** A short grace period keeps the panel open while the pointer crosses the gap. */
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  return (
    <>
      <nav className="hidden items-center gap-1 text-sm md:flex" onMouseLeave={scheduleClose}>
        {NAV_GROUPS.map((group) => {
          const isOpen = open === group.label;
          return (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => {
                cancelClose();
                setOpen(group.label);
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : group.label)}
                onFocus={() => setOpen(group.label)}
                className={`flex items-center gap-1.5 px-3 py-2 ${isOpen ? "text-foreground" : "text-muted"} hover:text-foreground`}
              >
                {group.label}
                <span aria-hidden className={`text-[0.6rem] transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {isOpen ? (
                <div
                  onMouseEnter={cancelClose}
                  className="absolute left-0 top-full z-20 w-80 border border-border bg-surface p-2"
                >
                  {group.links.map((link) => (
                    <Link
                      key={`${group.label}-${link.href}-${link.label}`}
                      href={link.href}
                      className="block px-3 py-2.5 hover:bg-raised"
                    >
                      <span className="block">{link.label}</span>
                      {link.description ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{link.description}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {NAV_DIRECT.map((link) => (
          <Link key={link.href} href={link.href} className="px-3 py-2 text-muted hover:text-foreground">
            {link.label}
          </Link>
        ))}
        <Link
          href={account.href}
          className="ml-2 border border-foreground px-3 py-1.5 text-xs tracking-wide uppercase hover:bg-foreground hover:text-background"
        >
          {account.label}
        </Link>
      </nav>

      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-label="Menu"
        onClick={() => setMobileOpen((value) => !value)}
        className="btn-secondary md:hidden"
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      {mobileOpen ? (
        <div className="w-full border-t border-border pt-4 md:hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="py-2">
              <p className="eyebrow">{group.label}</p>
              <ul className="mt-1 divide-y divide-border">
                {group.links.map((link) => (
                  <li key={`${group.label}-${link.href}-${link.label}`}>
                    <Link href={link.href} className="block py-2.5 text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-center gap-4 border-t border-border pt-4">
            {NAV_DIRECT.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm">
                {link.label}
              </Link>
            ))}
            <Link href={account.href} className="btn ml-auto">
              {account.label}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
