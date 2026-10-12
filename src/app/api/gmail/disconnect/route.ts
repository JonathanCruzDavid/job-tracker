import { NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/gmail/client";

export async function POST() {
  disconnectGmail();
  return NextResponse.json({ ok: true });
}
