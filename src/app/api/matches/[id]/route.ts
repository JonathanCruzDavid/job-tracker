import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/matches/[id]">,
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;

  if (action === "dismiss") {
    db.prepare("update job_matches set status = 'dismissed' where id = ?").run(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "save") {
    const match = db
      .prepare("select job_posting_id from job_matches where id = ?")
      .get(id) as { job_posting_id: string } | undefined;

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const applicationId = randomUUID();
    db.prepare(
      "insert into applications (id, job_posting_id, status) values (?, ?, 'saved')",
    ).run(applicationId, match.job_posting_id);
    db.prepare("update job_matches set status = 'saved' where id = ?").run(id);

    return NextResponse.json({ ok: true, applicationId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
