import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toLocalSqliteDateTime } from "@/lib/dateFormat";
import { findExistingApplication } from "@/lib/applications/findExistingApplication";

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

    // Exact same posting already tracked (e.g. a double-click, or this
    // posting was already saved through another path) — reuse it instead of
    // creating a second application for the identical posting.
    const existingForPosting = db
      .prepare("select id from applications where job_posting_id = ?")
      .get(match.job_posting_id) as { id: string } | undefined;

    if (existingForPosting) {
      db.prepare("update job_matches set status = 'saved' where id = ?").run(id);
      return NextResponse.json({ ok: true, applicationId: existingForPosting.id, alreadyTracked: true });
    }

    // Cross-source dedup — the same real job might already be tracked under
    // a different job_posting row (e.g. first picked up from a Gmail
    // confirmation email, now also captured by the extension).
    const posting = db
      .prepare("select company, title from job_postings where id = ?")
      .get(match.job_posting_id) as { company: string; title: string } | undefined;
    const existingByCompany = posting ? findExistingApplication(posting.company, posting.title) : null;

    if (existingByCompany) {
      db.prepare("update job_matches set status = 'saved' where id = ?").run(id);
      return NextResponse.json({ ok: true, applicationId: existingByCompany.id, alreadyTracked: true });
    }

    const applicationId = randomUUID();
    const now = toLocalSqliteDateTime(new Date());
    db.prepare(
      "insert into applications (id, job_posting_id, status, created_at, updated_at) values (?, ?, 'saved', ?, ?)",
    ).run(applicationId, match.job_posting_id, now, now);
    db.prepare("update job_matches set status = 'saved' where id = ?").run(id);

    return NextResponse.json({ ok: true, applicationId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
