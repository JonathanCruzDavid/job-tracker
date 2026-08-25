import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/applications/[id]/status">,
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as string | undefined;

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const current = db
    .prepare("select status from applications where id = ?")
    .get(id) as { status: string } | undefined;

  if (!current) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  db.prepare("update applications set status = ?, updated_at = datetime('now') where id = ?").run(
    status,
    id,
  );

  db.prepare(
    `insert into application_events (id, application_id, event_type, from_status, to_status)
     values (?, ?, 'status_change', ?, ?)`,
  ).run(randomUUID(), id, current.status, status);

  return NextResponse.json({ ok: true });
}
