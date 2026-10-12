import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/resumes/[id]/set-master">,
) {
  const { id } = await params;

  const resume = db.prepare("select id from resumes where id = ?").get(id) as
    | { id: string }
    | undefined;
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  db.prepare("update resumes set is_master = 0 where is_master = 1").run();
  db.prepare("update resumes set is_master = 1 where id = ?").run(id);

  return NextResponse.json({ ok: true });
}
