import { absoluteUrl, SITE_NAME } from "@/lib/site";

export type SendResult = { delivered: boolean; detail: string };

const FROM = process.env.EMAIL_FROM ?? "Qomvia <hello@qomvia.com>";

/**
 * Resend is optional: without a key nothing is sent, and the caller is told so
 * rather than pretending a login link is on its way.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { delivered: false, detail: "Email sending is not configured (RESEND_API_KEY missing)." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { delivered: false, detail: `Resend rejected the message: ${response.status} ${body.slice(0, 200)}` };
  }
  return { delivered: true, detail: "sent" };
}

export function loginLink(token: string): string {
  return absoluteUrl(`/login/verify?token=${encodeURIComponent(token)}`);
}

export async function sendLoginEmail(to: string, token: string): Promise<SendResult> {
  return sendEmail(
    to,
    `Your ${SITE_NAME} sign-in link`,
    [
      `Sign in to ${SITE_NAME}:`,
      "",
      loginLink(token),
      "",
      "The link works once and expires in 20 minutes.",
      "If you did not request it, ignore this email.",
    ].join("\n"),
  );
}
