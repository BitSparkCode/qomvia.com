import { NextResponse } from "next/server";
import { runNextImportJob } from "@/lib/products/jobs";

export const maxDuration = 300;

const BATCH = 5;

/** Drains the import queue a few jobs at a time; unfinished jobs return to `queued`. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ran: string[] = [];
  for (let index = 0; index < BATCH; index += 1) {
    const jobId = await runNextImportJob();
    if (!jobId) break;
    ran.push(jobId);
  }

  return NextResponse.json({ jobs: ran.length, ids: ran });
}
