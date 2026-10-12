import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveResumeFile } from "@/lib/resumeStorage";
import type { ResumeDocumentData } from "@/lib/pdf/resumeTemplate";
import { renderResumePdf } from "@/lib/pdf/renderResumePdf";
import { flattenResume } from "@/lib/pdf/flattenResume";
import { buildTailoredResumeFileName } from "@/lib/pdf/fileName";
import { toLocalSqliteDateTime } from "@/lib/dateFormat";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/applications/[id]/tailored-resume">,
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const resume = body?.resume as ResumeDocumentData | undefined;
  const masterResumeId = body?.masterResumeId as string | undefined;

  if (!resume || !resume.name || !masterResumeId) {
    return NextResponse.json({ error: "resume and masterResumeId are required" }, { status: 400 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderResumePdf(resume);
  } catch (err) {
    console.error("[applications/tailored-resume] PDF render failed", err);
    return NextResponse.json({ error: "Could not generate the PDF." }, { status: 500 });
  }

  const application = db
    .prepare(
      `select jp.title, jp.company from applications a
       join job_postings jp on jp.id = a.job_posting_id
       where a.id = ?`,
    )
    .get(id) as { title: string; company: string } | undefined;

  const fileName = buildTailoredResumeFileName(application?.company);

  const storagePath = saveResumeFile(pdfBuffer, fileName);
  const extractedText = flattenResume(resume);

  const resumeId = randomUUID();
  const now = toLocalSqliteDateTime(new Date());
  db.prepare(
    `insert into resumes (id, is_master, based_on_resume_id, application_id, file_name, storage_path, mime_type, extracted_text, created_at)
     values (?, 0, ?, ?, ?, ?, 'application/pdf', ?, ?)`,
  ).run(resumeId, masterResumeId, id, fileName, storagePath, extractedText, now);

  db.prepare("update applications set updated_at = datetime('now', 'localtime') where id = ?").run(id);

  db.prepare(
    `insert into application_events (id, application_id, event_type, note, resume_id, created_at)
     values (?, ?, 'tailored_resume_generated', ?, ?, ?)`,
  ).run(randomUUID(), id, fileName, resumeId, now);

  return NextResponse.json({ ok: true, resumeId });
}
