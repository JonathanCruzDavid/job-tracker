import { NextResponse } from "next/server";
import { ensureLegitimacyCheck } from "@/lib/legitimacyCheck";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/jobs/[id]/check-legitimacy">,
) {
  const { id } = await params;

  try {
    const result = await ensureLegitimacyCheck(id, true);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[jobs/check-legitimacy] failed", err);
    return NextResponse.json({ error: "Could not run the legitimacy check." }, { status: 502 });
  }
}
