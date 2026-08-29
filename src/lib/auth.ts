import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "qv_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 20 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").digest === undefined
    ? token
    : createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Issues a single-use login token. Only its hash is persisted, so the token in
 * the email is the only copy that can log anyone in.
 */
export async function createLoginToken(rawEmail: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const token = randomBytes(32).toString("base64url");
  await prisma.loginToken.create({
    data: { email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LOGIN_TTL_MS) },
  });
  return token;
}

/** Consumes a login token and starts a session cookie. Returns the user id. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  await prisma.loginToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const user = await prisma.user.upsert({
    where: { email: record.email },
    create: { email: record.email },
    update: {},
  });
  await linkExistingBrands(user.id, user.email);
  await startSession(user.id);
  return user.id;
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.authSession.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; email: string };

export async function currentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/**
 * A paying customer never registered separately: whatever they paid with is the
 * identity, so a first login claims the shops their Stripe email already bought.
 */
export async function linkExistingBrands(userId: string, email: string): Promise<void> {
  const brandIds = new Set<string>();
  const subscriptions = await prisma.subscription.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { brandId: true },
  });
  const orders = await prisma.auditOrder.findMany({
    where: { email: { equals: email, mode: "insensitive" }, status: { in: ["paid", "delivered"] } },
    select: { brandId: true },
  });
  for (const row of [...subscriptions, ...orders]) brandIds.add(row.brandId);

  for (const brandId of brandIds) {
    await prisma.brandMember.upsert({
      where: { userId_brandId: { userId, brandId } },
      create: { userId, brandId },
      update: {},
    });
  }
}

/** Creates the account for a paid checkout so the buyer can log in afterwards. */
export async function provisionAccount(rawEmail: string, brandId: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email.includes("@")) return;
  const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
  await prisma.brandMember.upsert({
    where: { userId_brandId: { userId: user.id, brandId } },
    create: { userId: user.id, brandId },
    update: {},
  });
}

export type Entitlement = { premium: boolean; tier: "MONITOR" | "AGENCY" | "AUDIT" | "NONE" };

/**
 * Membership alone does not unlock premium actions — the subscription or a paid
 * audit does, and it is re-checked on every privileged call.
 */
export async function entitlement(userId: string, brandId: string): Promise<Entitlement | null> {
  const member = await prisma.brandMember.findUnique({ where: { userId_brandId: { userId, brandId } } });
  if (!member) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { brandId },
    select: { status: true, tier: true },
  });
  if (subscription?.status === "active") return { premium: true, tier: subscription.tier };

  const order = await prisma.auditOrder.findFirst({
    where: { brandId, status: { in: ["paid", "delivered"] } },
    select: { id: true },
  });
  if (order) return { premium: true, tier: "AUDIT" };

  return { premium: false, tier: "NONE" };
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
