"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createLoginToken, currentUser, endSession, entitlement, normalizeEmail } from "@/lib/auth";
import { loginLink, sendLoginEmail } from "@/lib/email";
import { prisma } from "@/lib/db";
import { importFromCsv, importFromShopifyDomain, importFromUrl } from "@/lib/products/import";
import { RESCAN_COOLDOWN_MS, scanDomain } from "@/lib/scan-service";
import { runVisibility } from "@/lib/visibility/run";

export type FormState = { error?: string; ok?: string };

export async function requestLoginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const recent = await prisma.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 5) return { error: "Too many sign-in requests. Try again in a few minutes." };

  const token = await createLoginToken(email);
  const sent = await sendLoginEmail(email, token);
  if (!sent.delivered) {
    // Without an email provider the link cannot be delivered; say so instead of
    // implying an email is on the way. In development the link is logged.
    if (process.env.NODE_ENV !== "production") console.info(`[login] ${email}: ${loginLink(token)}`);
    return { error: `Could not send the sign-in email. ${sent.detail}` };
  }
  return { ok: `Sign-in link sent to ${email}. It expires in 20 minutes.` };
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

/** Every premium action re-checks session, membership and payment status. */
async function requirePremium(brandId: string) {
  const user = await currentUser();
  if (!user) return { error: "Sign in first." as const };
  const access = await entitlement(user.id, brandId);
  if (!access) return { error: "This store is not on your account." as const };
  if (!access.premium) return { error: "Re-scans and imports are part of the paid plans." as const };
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return { error: "Store not found." as const };
  return { brand, access };
}

export async function rescanAction(_state: FormState, formData: FormData): Promise<FormState> {
  const brandId = String(formData.get("brandId") ?? "");
  const guard = await requirePremium(brandId);
  if ("error" in guard) return { error: guard.error };

  const last = await prisma.scan.findFirst({
    where: { brandId, status: "COMPLETE" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESCAN_COOLDOWN_MS) {
    return { error: "That store was scanned within the last hour. Try again later." };
  }

  try {
    const { result } = await scanDomain(guard.brand.domain);
    revalidatePath("/dashboard");
    revalidatePath(`/site/${guard.brand.slug}`);
    return { ok: `Re-scan complete: ${result.score}/100 (grade ${result.grade}).` };
  } catch (error) {
    return { error: `Re-scan failed: ${(error as Error).message}` };
  }
}

export async function importProductsAction(_state: FormState, formData: FormData): Promise<FormState> {
  const brandId = String(formData.get("brandId") ?? "");
  const guard = await requirePremium(brandId);
  if ("error" in guard) return { error: guard.error };

  const source = String(formData.get("source") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  const csv = String(formData.get("csv") ?? "").trim();

  try {
    const result =
      source === "csv"
        ? await importFromCsv(brandId, csv)
        : source === "shopify"
          ? await importFromShopifyDomain(brandId, value || guard.brand.domain)
          : await importFromUrl(brandId, value);
    revalidatePath("/dashboard");
    return { ok: `Imported ${result.products} products.` };
  } catch (error) {
    return { error: `Import failed: ${(error as Error).message}` };
  }
}

export async function runVisibilityAction(_state: FormState, formData: FormData): Promise<FormState> {
  const brandId = String(formData.get("brandId") ?? "");
  const guard = await requirePremium(brandId);
  if ("error" in guard) return { error: guard.error };

  try {
    const run = await runVisibility(brandId, { trigger: "manual" });
    revalidatePath("/dashboard");
    return { ok: `Visibility run finished: index ${run.score}/100 across ${run.promptsRun} phrases.` };
  } catch (error) {
    return { error: `Visibility run failed: ${(error as Error).message}` };
  }
}
