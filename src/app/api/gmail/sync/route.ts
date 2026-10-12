import { NextResponse } from "next/server";
import { isGmailConnected } from "@/lib/gmail/client";
import { runGmailAutoSync } from "@/lib/gmail/autoSync";

// Manual trigger for the same sync the Applications page runs automatically
// every 30 minutes — this one ignores the throttle and is awaited, since a
// user who clicked "Refresh" is explicitly waiting on the result.
export async function POST() {
  if (!isGmailConnected()) {
    return NextResponse.json({ error: "Gmail is not connected." }, { status: 400 });
  }

  await runGmailAutoSync();

  return NextResponse.json({ ok: true });
}
