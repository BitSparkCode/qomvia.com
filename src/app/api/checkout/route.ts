import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDomain } from "@/lib/http";
import { upsertBrand } from "@/lib/scan-service";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { absoluteUrl, AGENCY_PRICE_CHF, MONITOR_PRICE_CHF } from "@/lib/site";
import { CREDIT_PACKS } from "@/lib/visibility/plans";

const schema = z.object({
  domain: z.string().min(3),
  product: z.enum(["monitor", "agency", "pack_1000", "pack_5000"]).default("monitor"),
  email: z.string().email().optional(),
});

const PRODUCTS = {
  monitor: {
    name: "Qomvia visibility monitoring",
    description: "Weekly product-level LLM visibility scan, agent-readiness re-scan and change alerts for one domain",
    amount: MONITOR_PRICE_CHF * 100,
    mode: "subscription" as const,
  },
  agency: {
    name: "Qomvia agency plan",
    description: "25 domains, daily refresh, all four model providers, competitor tracking and white-label reports",
    amount: AGENCY_PRICE_CHF * 100,
    mode: "subscription" as const,
  },
  pack_1000: {
    name: `Qomvia ${CREDIT_PACKS[0].credits} credit pack`,
    description: "One credit asks one question to one model in one market",
    amount: CREDIT_PACKS[0].priceChf * 100,
    mode: "payment" as const,
  },
  pack_5000: {
    name: `Qomvia ${CREDIT_PACKS[1].credits} credit pack`,
    description: "One credit asks one question to one model in one market",
    amount: CREDIT_PACKS[1].priceChf * 100,
    mode: "payment" as const,
  },
};

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let domain: string;
  try {
    domain = normalizeDomain(parsed.data.domain);
  } catch {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const client = stripe();
  if (!client || !stripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet. Email hello@qomvia.com and we will invoice you." },
      { status: 503 },
    );
  }

  const brand = await upsertBrand(domain);
  const product = PRODUCTS[parsed.data.product];

  const session = await client.checkout.sessions.create({
    mode: product.mode,
    customer_email: parsed.data.email,
    client_reference_id: brand.id,
    metadata: { brandId: brand.id, domain, product: parsed.data.product },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "chf",
          unit_amount: product.amount,
          product_data: { name: `${product.name} — ${domain}`, description: product.description },
          ...(product.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    success_url:
      product.mode === "payment"
        ? absoluteUrl("/dashboard")
        : absoluteUrl(`/site/${brand.slug}/report?session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: absoluteUrl(`/site/${brand.slug}?purchase=cancelled`),
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
