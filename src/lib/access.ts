import { prisma } from "@/lib/db";

/**
 * Paid access is proven by the Stripe Checkout session id, which the customer
 * receives on the success redirect and which is unguessable — so the paid report
 * and re-scans need no separate account system.
 */
export type PaidAccess =
  | { kind: "audit"; deepScanId: string | null }
  | { kind: "subscription" }
  | null;

export async function paidAccess(brandId: string, sessionId: string | null | undefined): Promise<PaidAccess> {
  if (!sessionId) return null;

  const order = await prisma.auditOrder.findFirst({
    where: { brandId, stripeSessionId: sessionId, status: { in: ["paid", "delivered"] } },
    select: { deepScanId: true },
  });
  if (order) return { kind: "audit", deepScanId: order.deepScanId };

  const subscription = await prisma.subscription.findFirst({
    where: { brandId, stripeSessionId: sessionId, status: "active" },
    select: { id: true },
  });
  if (subscription) return { kind: "subscription" };

  return null;
}
