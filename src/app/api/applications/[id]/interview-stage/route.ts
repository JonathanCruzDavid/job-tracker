import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/applications/[id]/interview-stage">,
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const interviewStage = typeof body?.interviewStage === "string" ? body.interviewStage : null;

  db.prepare(
    "update applications set interview_stage = ?, updated_at = datetime('now', 'localtime') where id = ?",
  ).run(interviewStage || null, id);

  return NextResponse.json({ ok: true });
}
