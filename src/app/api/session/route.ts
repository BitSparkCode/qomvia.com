import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

/**
 * Whether the request carries a valid session, and nothing else. The nav reads
 * this from the client so public pages stay statically cached: rendering the
 * header from the cookie would make every score page dynamic.
 */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    { signedIn: user !== null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
