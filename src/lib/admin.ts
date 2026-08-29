import { currentUser, normalizeEmail, type CurrentUser } from "@/lib/auth";

/**
 * Staff access is an env allowlist, not a database role: an attacker who can
 * write rows still cannot promote themselves, and there is no signup path to it.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter((entry) => entry.length > 0);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(normalizeEmail(email));
}

export async function currentAdmin(): Promise<CurrentUser | null> {
  const user = await currentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
