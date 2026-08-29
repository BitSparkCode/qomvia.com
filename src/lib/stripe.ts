import Stripe from "stripe";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

/** Returns null instead of throwing so the site works before Stripe is wired up. */
export function stripe(): Stripe | null {
  if (!stripeConfigured()) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return client;
}
