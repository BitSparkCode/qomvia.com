# Qomvia — Product Hunt launch kit

## Listing

**Name:** Qomvia
**Tagline (60 chars max):** Can AI agents actually buy from your store?
**Alternatives:**
- The agent-readiness score for online shops
- See your store the way an AI shopping agent sees it
- Get found, get trusted, get chosen by AI agents

**Links:** https://qomvia.com · score page example: https://qomvia.com/site/allbirds-com · methodology: https://qomvia.com/methodology

**Topics:** E-commerce, SEO, Artificial Intelligence, Marketing, Developer Tools

**Pricing:** Free score, paid audit from CHF 99, monitoring from CHF 29/month

## Description (260 chars)

Qomvia scans any storefront and scores whether AI shopping agents can read it, price it and check out on it — structured data, feeds, MCP, ACP/AP2, bot access, guest checkout. Free public score, plus product-level LLM visibility monitoring.

## Maker's first comment

Hi Product Hunt 👋

Last month I asked ChatGPT to buy a pair of running shoes for me. It recommended three shops — and none of them was the one I actually buy from. Not because that shop is worse, but because an agent literally cannot read it: JavaScript-rendered prices, no product feed, AI crawlers blocked in robots.txt, and a checkout that demands an account.

So I built Qomvia to measure that. Type a domain, and ~20 read-only requests later you get a 100-point agent-readiness score across six dimensions: machine access, product data legibility, agent-commerce protocols (ACP, AP2/x402, MCP), checkout traversability, agent-facing performance, policy clarity. Every result page is public and explains what each class of agent can and cannot do on the site: answer engines, autonomous shopping agents, MCP tool-callers, feed integrators, comparison bots, payment protocols.

We pre-scanned 50 large DACH and global storefronts to see where the market stands. The average is **39/100, and 46% score an F** — effectively closed to AI shopping agents. The best score in the set is 63. Nobody is above a C.

The second half is visibility: import your catalogue (Shopify, feed URL or CSV) and Qomvia turns your products into real shopping questions, asks OpenAI, Perplexity, Anthropic and Gemini weekly, and tracks whether you get mentioned, cited and at which rank — plus who gets recommended instead. Brand-level AI visibility tools exist; this is product-level, and it is tied to the fixes that change the outcome.

The crawler is deliberately boring: GET/HEAD only, no forms, no add-to-cart, no purchases, no login, no bot-challenge bypass. The rubric is published, and any shop can opt out.

Free: your score, your public page, an embeddable badge. Paid: the fix report, re-scans, catalogue import and weekly LLM visibility monitoring.

I would love to hear: what would make you act on a bad score — the number, the lost-revenue estimate, or seeing a competitor recommended instead of you?

## Feature bullets

- Free agent-readiness score for any storefront, no signup
- Public, shareable result page per shop with ✓ / ! / ✕ per signal
- Agent compatibility breakdown per agent class (answer engines, shopping agents, MCP, feeds, comparison bots, payments)
- Machine-interface detail: MCP, ACP, AP2/x402, product feed, JSON-LD, price/availability markup, stable IDs, llms.txt, AI crawler access, guest checkout
- Product-level LLM visibility: mention rate, citation rate, average rank, share of voice vs competitors
- Catalogue import from Shopify, product feed or CSV
- Weekly refresh (daily on agency plans), history and trend per phrase
- Paid fix report with the remediation order, evidence and copy-paste markup
- Embeddable badge that updates on every re-scan
- Published rubric, opt-out, read-only crawler

## Gallery (6 assets)

1. Hero: score dial at 39/100 with the headline "46% of large retailers score an F"
2. A real score page — dimension list with ✓ / ! / ✕
3. "Which AI agents can use this shop?" cards
4. Machine interfaces table (MCP / ACP / AP2 / feed / JSON-LD)
5. LLM visibility dashboard: index, mention rate, share of voice, history
6. Fix report preview (blurred detail) + pricing

## Launch sequence

- T-7: finish assets, line up 10-15 people who will genuinely comment, draft the LinkedIn/X posts
- T-3: publish the "State of agent commerce" scan of the 50 storefronts as the data-PR piece, pitch 5 retail/e-commerce journalists
- T-1: schedule the launch for 00:01 PT, pre-write replies to the objections below
- T-0: post, comment first, reply to everything within 15 minutes; share in Shopify/e-commerce/DACH founder communities (no vote begging — link the data, not the launch)
- T+1: publish the leaderboard update and email every scanned brand their own score with an opt-out
- T+7: post the follow-up "what changed in a week" scan diff

## Objections and answers

**"Is scoring companies without asking them legal?"** Everything is measured from public HTTP responses, GET/HEAD only, the methodology is published, and any domain can opt out and request a re-scan.

**"Agent commerce is not real yet."** ACP shipped with agentic checkout in ChatGPT, Google published AP2, and x402 exists. The point of a score is to be ready before the traffic arrives, not after.

**"Is this just another GEO tool?"** GEO tools measure brand mentions. Qomvia measures your products, and connects the visibility result to the structural reason for it plus the fix.

**"Will an agent really refuse my store?"** It does not refuse — it simply recommends the shop it can read. The scan shows exactly which of your interfaces it could not use.
