import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteResumeFile } from "@/lib/resumeStorage";

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/applications/[id]">,
) {
  const { id } = await params;

  const application = db
    .prepare("select job_posting_id from applications where id = ?")
    .get(id) as { job_posting_id: string } | undefined;

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const tailoredResumes = db
    .prepare("select storage_path from resumes where application_id = ?")
    .all(id) as { storage_path: string | null }[];

  db.prepare("delete from resumes where application_id = ?").run(id);
  db.prepare("delete from applications where id = ?").run(id);

  // Undo path for "I saved this by accident" — put the underlying match
  // back in the review queue instead of leaving it stuck as orphaned.
  db.prepare(
    "update job_matches set status = 'new' where job_posting_id = ? and status = 'saved'",
  ).run(application.job_posting_id);

  for (const resume of tailoredResumes) {
    if (resume.storage_path) deleteResumeFile(resume.storage_path);
  }

  return NextResponse.json({ ok: true });
}
