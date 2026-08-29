---
name: testing-qomvia-prod
description: How to log into qomvia.com (prod or local) without a mailbox, reach the prod Neon DB, and verify store-attach / domain-claim / catalogue-import flows end to end.
---

# Testing Qomvia auth-gated flows

## Signing in without access to the mailbox
Auth is passwordless magic link (`src/lib/auth.ts`, `src/lib/email.ts`). Emails go out via Resend and
you usually cannot read the target inbox. Mint the link yourself:

1. Get the prod DB URI (the `QOMVIA_DATABASE_URL` secret is a **Neon API key**, not a DB URL):
   ```bash
   DATABASE_URL="$(curl -s -H "Authorization: Bearer $QOMVIA_DATABASE_URL" \
     "https://console.neon.tech/api/v2/projects/<neon-project-id>/connection_uri?database_name=neondb&role_name=neondb_owner" \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["uri"])')"
   ```
2. Write a throwaway script **inside the repo** (e.g. `.qtest/login.mts`) — scripts outside the repo cannot
   resolve `@prisma/client`, and `tsx` needs an `.mts`/ESM extension because top-level `await` fails in CJS.
   Insert a `LoginToken` with `tokenHash = sha256(token)` and `expiresAt = now + 20min`, then open
   `https://<host>/login/verify?token=<token>` in Chrome. Delete the scripts afterwards.

## Verifying domain ownership without the domain's mailbox
`src/lib/stores/claim.ts` mails a 6-digit code to e.g. `info@<domain>`. Request the code through the UI to
prove Resend delivery + the `DomainClaim` row, test a wrong code (`That code does not match.`), then seed a
fresh `DomainClaim` with `codeHash = sha256("<known code>")` and confirm that code through the UI form.
Never weaken the code/auth logic to test it.

## Things that bite when testing catalogue import
- `attachStoreAction` drains up to 3 import jobs **inline**, and the sitemap importer fetches up to 60 pages
  with a 700 ms per-host throttle, so an attach of a sitemap-only shop can run for minutes and may die with
  Chrome's "This page couldn't load" (serverless timeout). Expect the `StoreLink` to exist anyway — reload
  `/dashboard` instead of re-submitting.
- Shops whose product pages carry no JSON-LD import 0 products, and the sitemap branch of
  `src/lib/products/jobs.ts` only marks `done` when `itemsImported >= min(itemsFound, maxProducts)`, so such a
  job requeues until `attempts = 3` and then sits in `queued` forever with no error text. Check
  `ImportJob.state/attempts/itemsFound/itemsImported` in the DB, not just the dashboard label.
- Probe a domain before testing import: `curl https://<d>/products.json?limit=250`, `/feed/products.xml`,
  `/googlebase.xml`, `/sitemap.xml`, and `grep ld+json` on a product page. A Shopify storefront such as
  `allbirds.com` is a good positive control (imports 200 products in ~20 s as a watched store).
- `detachStore` deletes only the `StoreLink`; `Competitor` rows created by `trackAgainstOwnedStores` and
  imported `Product` rows survive. Clean them up manually after tests on prod.
- Only one watched competitor is free (`FREE_WATCHED_STORES = 1`), so a slot-limit test needs just two
  throwaway domains.

## Devin secrets needed
- `QOMVIA_DATABASE_URL` — Neon API key used to fetch the prod connection URI (see above).
