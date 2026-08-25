import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readResumeFile } from "@/lib/resumeStorage";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/resumes/[id]/file">,
) {
  const { id } = await params;

  const resume = db
    .prepare("select file_name, storage_path, mime_type from resumes where id = ?")
    .get(id) as { file_name: string; storage_path: string | null; mime_type: string } | undefined;

  if (!resume || !resume.storage_path) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = readResumeFile(resume.storage_path);
  } catch (err) {
    console.error("[resumes/file] read failed", err);
    return NextResponse.json({ error: "Could not read file" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": resume.mime_type,
      "Content-Disposition": `attachment; filename="${resume.file_name.replace(/"/g, "")}"`,
    },
  });
}
