"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizeDomain } from "@/lib/http";
import { prisma } from "@/lib/db";
import { submitToIndexNow } from "@/lib/indexnow";
import { latestScan, RESCAN_COOLDOWN_MS, scanDomain, upsertBrand } from "@/lib/scan-service";

export type ScanFormState = { error?: string; ok?: string };

export async function scanAction(_state: ScanFormState, formData: FormData): Promise<ScanFormState> {
  const raw = String(formData.get("domain") ?? "").trim();
  if (!raw) return { error: "Enter a domain, for example digitec.ch" };

  let domain: string;
  try {
    domain = normalizeDomain(raw);
  } catch {
    return { error: "That does not look like a domain." };
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: "That does not look like a domain." };

  const brand = await upsertBrand(domain);
  if (brand.optedOut) return { error: "This domain has opted out of public scoring." };

  const existing = await latestScan(brand.id);
  const fresh = existing && Date.now() - existing.createdAt.getTime() < RESCAN_COOLDOWN_MS;

  if (!fresh) {
    try {
      await scanDomain(domain);
    } catch (error) {
      return { error: `Scan failed: ${(error as Error).message}` };
    }
    revalidatePath(`/site/${brand.slug}`);
    revalidatePath("/leaderboard");
    await submitToIndexNow([`/site/${brand.slug}`]);
  }

  redirect(`/site/${brand.slug}`);
}

export async function optOutAction(_state: ScanFormState, formData: FormData): Promise<ScanFormState> {
  const raw = String(formData.get("domain") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!raw || !email.includes("@")) return { error: "Enter the domain and a contact email at that domain." };
  let domain: string;
  try {
    domain = normalizeDomain(raw);
  } catch {
    return { error: "That does not look like a domain." };
  }
  if (!email.toLowerCase().endsWith(`@${domain}`)) {
    return { error: `Use an email address at ${domain} so we can verify the request.` };
  }
  await prisma.brand.updateMany({ where: { domain }, data: { optedOut: true } });
  revalidatePath("/leaderboard");
  return { ok: `${domain} is opted out. Existing public pages will be removed within 24 hours.` };
}
