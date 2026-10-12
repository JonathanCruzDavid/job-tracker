import { NextResponse } from "next/server";
import { importAndScoreJob } from "@/lib/jobs/importJob";

const SOURCE_SITES = ["LinkedIn", "Indeed", "Company website", "Other"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : "";
  const company = typeof body?.company === "string" ? body.company : "";
  const description = typeof body?.description === "string" ? body.description : "";
  const url = typeof body?.url === "string" ? body.url.trim() : null;
  const sourceSite =
    typeof body?.sourceSite === "string" && SOURCE_SITES.includes(body.sourceSite)
      ? body.sourceSite
      : null;

  const result = await importAndScoreJob({ title, company, description, url, sourceSite });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { ok: _ok, legitimacy, ...rest } = result;
  void _ok;

  return NextResponse.json({ ...rest, ...legitimacy });
}
