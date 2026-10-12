import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toLocalSqliteDateTime } from "@/lib/dateFormat";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/applications/[id]/notes">,
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const notes = typeof body?.notes === "string" ? body.notes : "";

  db.prepare("update applications set notes = ?, updated_at = datetime('now', 'localtime') where id = ?").run(
    notes,
    id,
  );

  db.prepare(
    "insert into application_events (id, application_id, event_type, created_at) values (?, ?, 'note_added', ?)",
  ).run(randomUUID(), id, toLocalSqliteDateTime(new Date()));

  return NextResponse.json({ ok: true });
}
