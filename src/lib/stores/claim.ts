import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { normalizeEmail, safeEqual } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";

const CLAIM_TTL_MS = 30 * 60 * 1000;

/**
 * Only addresses a shop controls administratively count as proof — a personal
 * mailbox at the domain would let any employee or ex-agency claim the store.
 */
export const CLAIM_MAILBOXES = ["admin", "webmaster", "hostmaster", "postmaster", "info", "hello", "shop", "owner"];

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export type ClaimResult = { ok: string } | { error: string };

export async function startDomainClaim(userId: string, brandId: string, mailbox: string): Promise<ClaimResult> {
  const link = await prisma.storeLink.findUnique({
    where: { userId_brandId: { userId, brandId } },
    select: { verifiedAt: true },
  });
  if (!link) return { error: "Attach the store first." };
  if (link.verifiedAt) return { error: "This store is already verified." };

  const local = mailbox.trim().toLowerCase();
  if (!CLAIM_MAILBOXES.includes(local)) {
    return { error: `Pick one of these addresses: ${CLAIM_MAILBOXES.join(", ")}.` };
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { domain: true } });
  if (!brand) return { error: "Store not found." };

  const recent = await prisma.domainClaim.count({
    where: { userId, brandId, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 3) return { error: "Too many codes requested. Try again in a few minutes." };

  const email = normalizeEmail(`${local}@${brand.domain.replace(/^www\./, "")}`);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.domainClaim.create({
    data: { userId, brandId, email, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CLAIM_TTL_MS) },
  });

  const sent = await sendEmail(
    email,
    `Confirm ${brand.domain} on ${SITE_NAME}`,
    [
      `Someone asked to manage ${brand.domain} on ${SITE_NAME}.`,
      "",
      `Confirmation code: ${code}`,
      "",
      "The code expires in 30 minutes. If this was not you, ignore this email.",
    ].join("\n"),
  );
  if (!sent.delivered) return { error: `Could not send the code. ${sent.detail}` };

  return { ok: `Code sent to ${email}. Enter it below within 30 minutes.` };
}

/** Verifying turns the link into ownership and grants the membership premium actions check. */
export async function confirmDomainClaim(userId: string, brandId: string, code: string): Promise<ClaimResult> {
  const claim = await prisma.domainClaim.findFirst({
    where: { userId, brandId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!claim) return { error: "No pending code. Request a new one." };
  if (!safeEqual(hashCode(code.trim()), claim.codeHash)) return { error: "That code does not match." };

  await prisma.domainClaim.update({ where: { id: claim.id }, data: { usedAt: new Date() } });
  await prisma.storeLink.update({
    where: { userId_brandId: { userId, brandId } },
    data: { kind: "owned", verifiedAt: new Date() },
  });
  await prisma.brandMember.upsert({
    where: { userId_brandId: { userId, brandId } },
    create: { userId, brandId },
    update: {},
  });

  return { ok: "Ownership confirmed. Re-scans, the fix report and the seal are unlocked on your plan." };
}
