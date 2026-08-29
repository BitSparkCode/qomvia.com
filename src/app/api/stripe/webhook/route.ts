import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { scanDomain } from "@/lib/scan-service";
import { stripe } from "@/lib/stripe";

export const maxDuration = 300;

async function fulfilDeepAudit(session: Stripe.Checkout.Session) {
  const brandId = session.metadata?.brandId;
  const domain = session.metadata?.domain;
  if (!brandId || !domain) return;

  const order = await prisma.auditOrder.upsert({
    where: { stripeSessionId: session.id },
    create: {
      brandId,
      email: session.customer_details?.email ?? null,
      amountCents: session.amount_total ?? 0,
      stripeSessionId: session.id,
      status: "paid",
      paidAt: new Date(),
    },
    update: {
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    },
  });

  const deep = await scanDomain(domain, "DEEP");
  await prisma.auditOrder.update({
    where: { id: order.id },
    data: { status: "delivered", deepScanId: deep.scan.id },
  });
}

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
    },
    update: {
      status: "active",
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    },
  });
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
      else await fulfilDeepAudit(session);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
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
