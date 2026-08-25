import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPendingBookmarks } from "@/lib/bookmarks";

export async function GET() {
  const importedUrls = db
    .prepare("select url from job_postings where url is not null")
    .all() as { url: string }[];
  const dismissedUrls = db.prepare("select url from dismissed_bookmarks").all() as {
    url: string;
  }[];

  const exclude = new Set([
    ...importedUrls.map((r) => r.url),
    ...dismissedUrls.map((r) => r.url),
  ]);

  return NextResponse.json({ pending: getPendingBookmarks(exclude) });
}
