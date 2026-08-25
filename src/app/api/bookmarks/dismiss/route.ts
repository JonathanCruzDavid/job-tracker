import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : null;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  db.prepare("insert or ignore into dismissed_bookmarks (url) values (?)").run(url);
  return NextResponse.json({ ok: true });
}
