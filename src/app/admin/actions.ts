"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { currentAdmin } from "@/lib/admin";
import type { FormState } from "@/app/auth-actions";
import { prisma } from "@/lib/db";
import { addCredits, grantPlanCredits } from "@/lib/visibility/credits";

const TIERS: PlanTier[] = ["MONITOR", "AGENCY"];

function parseTier(value: string): PlanTier | null {
  return TIERS.find((tier) => tier === value) ?? null;
}

/**
 * Overrides a store's plan without Stripe: the same `Subscription` row the
 * webhook writes, so entitlement, prompt budgets and credit grants all behave
 * as if it had been paid for.
 */
export async function setSubscriptionAction(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await currentAdmin();
  if (!admin) return { error: "Not authorized." };

  const brandId = String(formData.get("brandId") ?? "");
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { domain: true } });
  if (!brand) return { error: "Store not found." };

  const raw = String(formData.get("tier") ?? "");
  const email = String(formData.get("email") ?? admin.email);
  const userId = String(formData.get("userId") ?? "");

  if (raw === "none") {
    await prisma.subscription.updateMany({ where: { brandId }, data: { status: "canceled" } });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { ok: `${brand.domain} set back to no plan.` };
  }

  const tier = parseTier(raw);
  if (!tier) return { error: "Pick a plan." };

  await prisma.subscription.upsert({
    where: { brandId },
    create: { brandId, email, tier, status: "active" },
    update: { tier, status: "active", email },
  });
  // Paying for a store is itself proof enough elsewhere in the product, so an
  // override grants the same thing: membership, and the owned link the premium
  // guard checks. Without this the plan would be active but every button locked.
  if (userId) {
    await prisma.brandMember.upsert({ where: { userId_brandId: { userId, brandId } }, create: { userId, brandId }, update: {} });
    await prisma.storeLink.updateMany({
      where: { userId, brandId },
      data: { kind: "owned", verifiedAt: new Date() },
    });
  }
  const granted = await grantPlanCredits(brandId, tier);

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    ok: `${brand.domain} is on ${tier}${granted > 0 ? ` · ${granted} credits granted` : " · credits already granted this period"}.`,
  };
}

export async function grantCreditsAction(_state: FormState, formData: FormData): Promise<FormState> {
  const admin = await currentAdmin();
  if (!admin) return { error: "Not authorized." };

  const brandId = String(formData.get("brandId") ?? "");
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { domain: true } });
  if (!brand) return { error: "Store not found." };

  const credits = Number(formData.get("credits") ?? 0);
  if (!Number.isInteger(credits) || credits <= 0 || credits > 100_000) {
    return { error: "Enter a whole number of credits between 1 and 100000." };
  }

  // Reason records who granted them, so a balance can always be explained.
  await addCredits(brandId, credits, `admin:${admin.email}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: `${credits} credits added to ${brand.domain}.` };
}
