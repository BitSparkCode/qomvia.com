"use client";

import { useEffect, useState } from "react";

/**
 * Reads the session from `/api/session` after mount. The session cookie is
 * http-only and the shell is served from the static cache, so the header cannot
 * know at render time whether the visitor is signed in.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean }) => setSignedIn(data.signedIn === true))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return signedIn;
}
