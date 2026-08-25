import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ResumeDocumentData } from "@/lib/pdf/resumeTemplate";
import { renderResumePdf } from "@/lib/pdf/renderResumePdf";
import { buildTailoredResumeFileName } from "@/lib/pdf/fileName";

// Stateless render — no DB write. Lets the UI show the actual PDF at any
// point (right after generation, or after edits) without prematurely
// persisting content the user hasn't confirmed yet.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const resume = body?.resume as ResumeDocumentData | undefined;
  const applicationId = body?.applicationId as string | undefined;

  if (!resume || !resume.name) {
    return NextResponse.json({ error: "resume is required" }, { status: 400 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderResumePdf(resume);
  } catch (err) {
    console.error("[resumes/render-preview] PDF render failed", err);
    return NextResponse.json({ error: "Could not render the PDF." }, { status: 500 });
  }

  const application = applicationId
    ? (db
        .prepare(
          `select jp.company from applications a
           join job_postings jp on jp.id = a.job_posting_id
           where a.id = ?`,
        )
        .get(applicationId) as { company: string } | undefined)
    : undefined;

  const fileName = buildTailoredResumeFileName(application?.company);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "X-File-Name": fileName,
    },
  });
}
