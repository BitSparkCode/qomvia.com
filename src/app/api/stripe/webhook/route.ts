import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { provisionAccount } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { addCredits, grantPlanCredits } from "@/lib/visibility/credits";
import { CREDIT_PACKS } from "@/lib/visibility/plans";

export const maxDuration = 300;

async function recordSubscription(session: Stripe.Checkout.Session) {
  const brandId = session.metadata?.brandId;
  if (!brandId) return;
  const tier = session.metadata?.product === "agency" ? "AGENCY" : "MONITOR";
  await prisma.subscription.upsert({
    where: { brandId },
    create: {
      brandId,
      email: session.customer_details?.email ?? "",
      tier,
      status: "active",
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
      stripeSessionId: session.id,
    },
    update: {
      status: "active",
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
      stripeSessionId: session.id,
    },
  });

  await grantPlanCredits(brandId, tier);

  const email = session.customer_details?.email;
  if (email) await provisionAccount(email, brandId);
}

const PACK_CREDITS: Record<string, number> = {
  pack_1000: CREDIT_PACKS[0].credits,
  pack_5000: CREDIT_PACKS[1].credits,
};

async function recordCreditPack(session: Stripe.Checkout.Session) {
  const brandId = session.metadata?.brandId;
  const product = session.metadata?.product;
  if (!brandId || !product) return;
  const credits = PACK_CREDITS[product];
  if (!credits) return;
  await addCredits(brandId, credits, `pack:${session.id}`);

  const email = session.customer_details?.email;
  if (email) await provisionAccount(email, brandId);
}

export async function POST(request: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    return NextResponse.json({ error: `Invalid signature: ${(error as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      if (session.mode === "subscription") await recordSubscription(session);
      if (session.mode === "payment") await recordCreditPack(session);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (customerId) {
      const subscription = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId, status: "active" },
        select: { brandId: true, tier: true },
      });
      if (subscription) await grantPlanCredits(subscription.brandId, subscription.tier);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "cancelled" },
    });
  }

  return NextResponse.json({ received: true });
}
