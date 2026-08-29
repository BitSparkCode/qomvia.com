import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeDomain } from "@/lib/http";
import { upsertBrand } from "@/lib/scan-service";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { absoluteUrl, AGENCY_PRICE_CHF, DEEP_AUDIT_PRICE_CHF, MONITOR_PRICE_CHF } from "@/lib/site";

const schema = z.object({
  domain: z.string().min(3),
  product: z.enum(["deep_audit", "monitor", "agency"]).default("deep_audit"),
  email: z.string().email().optional(),
});

const PRODUCTS = {
  deep_audit: {
    name: "Agent Commerce deep audit",
    description: "500-URL agent-readiness audit with prioritised fixes and PDF report",
    amount: DEEP_AUDIT_PRICE_CHF * 100,
    mode: "payment" as const,
  },
  monitor: {
    name: "Agent Commerce monitoring",
    description: "Weekly re-scan, change alerts and a live badge for one domain",
    amount: MONITOR_PRICE_CHF * 100,
    mode: "subscription" as const,
  },
  agency: {
    name: "Agent Commerce agency plan",
    description: "25 domains, competitor tracking, API access and white-label reports",
    amount: AGENCY_PRICE_CHF * 100,
    mode: "subscription" as const,
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
      { error: "Payments are not configured yet. Email hello@agent-commerce.io and we will invoice you." },
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
    success_url: absoluteUrl(`/site/${brand.slug}?purchase=success&session_id={CHECKOUT_SESSION_ID}`),
    cancel_url: absoluteUrl(`/site/${brand.slug}?purchase=cancelled`),
    allow_promotion_codes: true,
  });

  if (parsed.data.product === "deep_audit") {
    await prisma.auditOrder.create({
      data: {
        brandId: brand.id,
        email: parsed.data.email,
        amountCents: product.amount,
        stripeSessionId: session.id,
      },
    });
  }

  return NextResponse.json({ url: session.url });
}
