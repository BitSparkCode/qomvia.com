import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=missing", request.url));

  const userId = await consumeLoginToken(token);
  if (!userId) return NextResponse.redirect(new URL("/login?error=expired", request.url));

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
