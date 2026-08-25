import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tailorResume, reviseResume } from "@/lib/anthropic/tailorResume";
import type { ResumeDocumentData } from "@/lib/pdf/resumeTemplate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const applicationId = body?.applicationId as string | undefined;
  const currentDraft = body?.currentDraft as ResumeDocumentData | undefined;
  const feedback = typeof body?.feedback === "string" ? body.feedback : undefined;

  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const posting = db
    .prepare(
      `select jp.title, jp.company, jp.description
       from applications a
       join job_postings jp on jp.id = a.job_posting_id
       where a.id = ?`,
    )
    .get(applicationId) as { title: string; company: string; description: string | null } | undefined;

  if (!posting) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const master = db
    .prepare("select id, extracted_text from resumes where is_master = 1")
    .get() as { id: string; extracted_text: string | null } | undefined;

  if (!master || !master.extracted_text) {
    return NextResponse.json({ error: "Upload a master resume first" }, { status: 400 });
  }

  try {
    // With a current draft + feedback, this is "apply the changes we
    // discussed" — revise on top of the existing draft. Otherwise it's the
    // first-ever generation for this application, from scratch.
    const result =
      currentDraft && feedback
        ? await reviseResume({
            originalResumeText: master.extracted_text,
            currentDraft,
            title: posting.title,
            company: posting.company,
            description: posting.description ?? "",
            feedback,
          })
        : await tailorResume({
            resumeText: master.extracted_text,
            title: posting.title,
            company: posting.company,
            description: posting.description ?? "",
          });

    return NextResponse.json({ ...result, masterResumeId: master.id });
  } catch (err) {
    console.error("[resumes/tailor] generation failed", err);
    return NextResponse.json({ error: "Could not generate a tailored resume." }, { status: 502 });
  }
}
