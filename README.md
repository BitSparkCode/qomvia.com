# Agent Commerce

Can AI agents actually buy from your store? Agent Commerce measures a storefront
against a transparent 100-point rubric and publishes a public score page for it.

- Free public score, shareable badge, leaderboard, aggregate market report.
- CHF 99 deep audit, CHF 29/month monitoring, CHF 149/month agency plan (Stripe Checkout).
- Open rubric: every point is documented at `/methodology` and every measurement
  is returned by `/api/score/<slug>`.

## Rubric v1

| Dimension | Points |
| --- | --- |
| Machine access (AI crawler rules, bot response, server-rendered HTML) | 25 |
| Product data legibility (Product JSON-LD, offers, identifiers, feed) | 25 |
| Agent-commerce protocols (ACP, llms.txt, MCP/A2A, x402/AP2) | 20 |
| Checkout traversability (cart reachability, guest checkout, form semantics) | 15 |
| Agent-facing performance (TTFB, payload, sitemap) | 10 |
| Policy clarity (automated-access policy, machine-readable contact) | 5 |

Grades: A 90+, B 75+, C 60+, D 40+, F below 40.

## Crawler safety

`AgentCommerceBot/1.0` issues GET requests only — roughly 20 per public scan, one
at a time per host, 2 MB and 15 s caps, private address ranges refused. It never
submits a form, adds to a cart, attempts a purchase, logs in, or tries to defeat
a CAPTCHA or bot challenge. `src/lib/__tests__/crawl-safety.test.ts` fails the
build if that changes. Store operators can block the bot in robots.txt or remove
their page at `/opt-out`.

## Development

```bash
cp .env.example .env      # set DATABASE_URL at minimum
npx prisma migrate deploy # or: npx prisma migrate dev
npm run dev
```

Checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Launch dataset

`npm run precrawl -- scripts/brands.txt 4` scans the launch brand set, fills the
leaderboard and prints the headline statistic that `/report` publishes.

## Operations

- `POST /api/scan` — score a domain (1 h cache per domain).
- `GET /api/score/<slug>` — published score with every signal and its evidence.
- `GET /badge/<slug>.svg` — live embeddable badge.
- `POST /api/cron/rescan` — weekly re-scan batch, `Authorization: Bearer $CRON_SECRET`.
  Monitored domains first, then the stalest pages; score changes create alert rows.
- `POST /api/stripe/webhook` — payment fulfilment; a paid deep audit triggers a
  500-URL deep scan automatically.
