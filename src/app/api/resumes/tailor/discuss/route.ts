import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discussResume, type ChatMessage } from "@/lib/anthropic/discussResume";
import { flattenResume } from "@/lib/pdf/flattenResume";
import type { ResumeDocumentData } from "@/lib/pdf/resumeTemplate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const applicationId = body?.applicationId as string | undefined;
  const resume = body?.resume as ResumeDocumentData | undefined;
  const history = (body?.history as ChatMessage[] | undefined) ?? [];
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!applicationId || !resume || !message) {
    return NextResponse.json(
      { error: "applicationId, resume, and message are required" },
      { status: 400 },
    );
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

  try {
    const reply = await discussResume({
      resumeText: flattenResume(resume),
      title: posting.title,
      company: posting.company,
      description: posting.description ?? "",
      history,
      message,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[resumes/tailor/discuss] failed", err);
    return NextResponse.json({ error: "Could not get a response." }, { status: 502 });
  }
}
