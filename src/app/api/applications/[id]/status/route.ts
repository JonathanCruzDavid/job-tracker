import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setApplicationStatus } from "@/lib/applications/statusTransitions";

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

  // "Applied" can only be set from a confirmed email (see
  // /api/gmail/scan-applications/confirm, which writes directly and
  // bypasses this route) — never manually. Every other status change still
  // goes through here normally.
  if (status === "applied") {
    return NextResponse.json(
      { error: "Applied can only be confirmed from a real email — use Check Gmail for missed applications." },
      { status: 400 },
    );
  }

  const current = db
    .prepare("select status from applications where id = ?")
    .get(id) as { status: string } | undefined;

  if (!current) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  setApplicationStatus(id, current.status, status);

  return NextResponse.json({ ok: true });
}
