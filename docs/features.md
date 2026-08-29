# Qomvia feature inventory

Source of truth for website copy. If a feature is not listed here as **Live**, it must not be
claimed on the site. Update this file in the same PR as the change it describes.

Status values: **Live** (in production and exercised), **Live, needs key** (implemented, requires a
provider/billing credential to work), **Partial** (implemented but limited), **Legacy** (kept only
for existing records, not sold), **Planned** (not implemented — never in site copy).

---

## 1. Free public agent-readiness score

| Feature | Status | Description |
| --- | --- | --- |
| Domain scan | Live | Enter a domain, get a 0–100 score and A–F grade from ~20 read-only HTTP requests. First scan per domain is free and public; re-scans are paid. |
| Rubric v1 | Live | 21 signals in 6 dimensions: machine access (25), product-data legibility (25), agent-commerce protocols (20), checkout traversability (15), agent-facing performance (10), policy clarity (5). |
| Public result page | Live | `/site/<slug>`: a verdict sentence, blocker/weak-spot/passed counts, the five findings that cost the shop most (title and consequence only), agent compatibility, and every signal as ✓ / ! / ✕ / ? behind disclosure — no point values, no fix instructions, no evidence. |
| Severity model | Live | Findings are ranked blocker / improvement / polish: a failed signal required by an agent class, or a heavy loss, is a blocker. Each carries an effort estimate (minutes / hours / dev ticket). |
| Product page | Live | `/visibility`: how LLM product visibility works, what a run measures, the index weighting and what a tracked competitor reports. |
| Agent-compatibility breakdown | Live | Per agent class (crawler/RAG, shopping & checkout agents, MCP tool-callers, API/feed integrators, price bots): can it use this shop, and what breaks. |
| Machine-interface detail | Live | Presence and quality of MCP endpoint, ACP/agentic checkout, product API, product feed, JSON-LD, `llms.txt`, robots/UA allowances. |
| Earned seal | Live | Four tiers, no number shown: AI Commerce Champion (90+), AI Commerce Ready (75+), Agent-Readable (60+) and In Progress (40+, dashboard only, not embeddable). JavaScript-only embed (`/badge.js`), markup served per request by `/api/badge/<slug>`; nothing renders below 60, so the seal cannot be copied, faked or go stale. |
| Leaderboard | Live | Every scored storefront, ranked; opted-out domains excluded. |
| The index (`/report`) | Live | Aggregate state of agent readiness across all scored shops: average score, grade distribution, worst dimensions. |
| Comparison pages | Live | `/compare/<a>-vs-<b>`: two shops side by side. |
| Public JSON API | Live | `/api/score/<slug>` returns the current score, grade and signal statuses. Free to cite. |
| Methodology | Live | Public page states what is scored (six categories), the grade bands and what the crawler never does. The signal-by-signal rubric with weights lives behind login at `/methodology/signals`. |
| Crawler transparency | Live | `/bot`: QomviaBot identity, GET/HEAD only, rate limits, no forms, no cart, no login, no CAPTCHA bypass. |
| Opt-out | Live | `/opt-out`: verified by an email address at the domain; removes the shop from the public index. |
| SEO/GEO infrastructure | Live | Server-rendered pages with real measurements, per-page metadata, canonicals, `Dataset` JSON-LD, dynamic OG images, dated sitemap, `llms.txt`, IndexNow submission on every new scan. |

## 2. Accounts

| Feature | Status | Description |
| --- | --- | --- |
| Passwordless login | Live | Magic link by email; only token hashes are stored. Sessions are server-verified. |
| Store attachment | Live | A store is attached to the email that paid for it; membership governs all premium actions. |
| Dashboard | Live | `/dashboard` (noindex): readiness status, failing signals, catalogue, visibility, competitors, credits. |
| On-demand re-scan | Live | Re-scan a store from the dashboard. Paid plans only. |
| Paid fix report | Live | `/site/<slug>/report` (noindex): a grade target ("fix the first N and you reach grade B"), findings in blocker / improvement / polish tiers, severity and effort per finding, copy-pasteable snippets filled with the shop's own domain, evidence as a readable table behind disclosure, and anything that regressed since the previous scan flagged as new. |

## 3. Catalogue import

| Feature | Status | Description |
| --- | --- | --- |
| Shopify import | Live | Reads the public `/products.json` of a storefront. No app install, no credentials. |
| Feed import | Live | Google Merchant XML, RSS product feeds, JSON catalogues. |
| CSV paste | Live | Columns: id, title, description, category, price, currency, gtin, link, image. |
| JSON-LD fallback | Live | Extracts products from structured data when no feed exists. |
| Localised price parsing | Live | Handles `1'289.90 CHF`, `1.289,90 €` and similar. |
| Product watchlist | Live | Per-product `tracked` flag: only tracked products consume credits, so a shop chooses what it pays to measure. Defaults to the whole catalogue when nothing is selected. |

## 4. LLM product visibility

| Feature | Status | Description |
| --- | --- | --- |
| Prompt generation | Live | Buying-intent phrases derived from the catalogue: one per tracked product, deeper variants for the 40 highest-value products, plus category, comparison and brand-trust phrases. Deduplicated, budget-capped, exact text stored. |
| Localisation | Live | Phrases are generated per market locale in German, English and French with region wording (CH/DE/AT/FR). Monitor covers 1 locale, Agency 3. |
| Providers | Live, needs key | OpenAI and Anthropic keys are configured in production; Perplexity and Gemini are implemented and activate when their keys are set. Model per provider is env-overridable. |
| Catalogue rotation | Live | Runs draw the least-recently-asked phrases first, so successive runs cover the whole catalogue instead of re-asking the same head phrases. |
| Answer measurement | Live | Per answer: was the shop mentioned, was it linked (cited), at which position among the retailers named, and which competitors appeared. |
| Visibility index | Live | 0–100 from mention rate (60%), citation rate (20%) and position quality (20%), plus average rank. |
| Competitor index | Live | Every retailer named in an answer is aggregated per shop with mention count, "wins" (named while the shop was absent) and last-seen date. |
| Share of voice | Live | Top 15 competitors by share of answers they appear in. |
| Tracked competitors | Live | A shop adds competitor domains in the dashboard. Every run then reports that domain by name as well as by link, so it is counted even in answers that never cite it: answers naming it, share of answers, and the phrases where it is recommended while the shop is absent. |
| Recommendations | Live | Derived from measured evidence: failing readiness signals, phrases lost to named competitors, brand-vs-category gap, mentioned-but-not-linked, position, silent tracked products, weakest locale. |
| Run history | Live | Every completed run keeps index, mention rate, citation rate, average rank, locales, products covered, credits and provider cost. |
| Answer cache | Live | Answers are keyed by phrase + model + locale and reused for 7 days, so phrases shared across shops are paid for once. |
| Scheduled refresh | Live, needs key | `/api/cron/rescan` refreshes by tier: weekly on Monitor, daily on Agency. Requires the cron to be enabled in Vercel. |
| Change alerts | Live | Email when a readiness score changes between scans. |

## 5. Commercial model

| Feature | Status | Description |
| --- | --- | --- |
| Public score | Live | Free, no signup. |
| Monitoring — CHF 29/month | Live, needs key | One domain, weekly readiness re-scan and visibility run, 300 phrases per run, ChatGPT + Perplexity, 1 locale, 600 credits/month. Needs Stripe keys. |
| Agency — CHF 149/month | Live, needs key | 25 domains, daily refresh, 1,000 phrases per run, all four providers, 3 locales, 4,000 credits/month, white-label reports. |
| Competitor slots — CHF 19/month | Live, needs key | One tracked competitor domain per slot; 1 included on Monitor, 5 on Agency, more bought as separate subscriptions from the dashboard. A tracked competitor re-reads answers already paid for, so the marginal provider cost is single-digit rappen a month — 10–100× coverage. |
| Credits | Live | 1 credit = one phrase asked to one model in one locale. CHF 0.05 each; packs of 1,000 (CHF 49) and 5,000 (CHF 199), bought from the dashboard. Append-only ledger; credits are reserved in a serializable transaction before any provider call and refunded when a run fails. |
| Credit grants | Live, needs key | Plan allowance is granted on checkout and on every paid Stripe invoice, at most once per 30 days. |
| Cost accounting | Live | Every run stores its real provider cost in cents next to the credits it consumed, so margin per shop is auditable. |
| Done-for-you enablement | Planned | Feed hosting, structured-data fixes, `llms.txt` and an agentic-checkout endpoint settled through the merchant's own Stripe. Sold manually, not self-serve. |
| Deep audit | Legacy | Withdrawn. `AuditOrder` and the audit entitlement path remain so past purchases keep access; not sold and not mentioned on the site. |

## 6. Launch assets

| Feature | Status | Description |
| --- | --- | --- |
| Product Hunt kit | Live | `docs/product-hunt-launch.md`: tagline, description, gallery plan, first comment, checklist. |
| Launch dataset | Live | 50 DACH/global storefronts pre-scanned: average 39/100, 46% graded F. |

---

## Copy rules

1. One claim per section; the claim must map to a **Live** row above.
2. Lead with the merchant's outcome ("be recommended", "be reachable"), not with our mechanism.
3. Never publish fix instructions, evidence or remediation detail on public pages.
4. Never imply providers or locales beyond the table above.
5. Footer statement, verbatim: *Qomvia — independent measurement of agent readiness. Scores are computed from public HTTP responses.*
