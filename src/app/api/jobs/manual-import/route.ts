import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db, toJson, fromJson } from "@/lib/db";
import { scoreMatch } from "@/lib/anthropic/scoreMatch";

const SOURCE_SITES = ["LinkedIn", "Indeed", "Company website", "Other"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : null;
  const sourceSite =
    typeof body?.sourceSite === "string" && SOURCE_SITES.includes(body.sourceSite)
      ? body.sourceSite
      : null;

  if (!title || !company || !description) {
    return NextResponse.json(
      { error: "Title, company, and description are required." },
      { status: 400 },
    );
  }

  const master = db
    .prepare("select id, extracted_text from resumes where is_master = 1")
    .get() as { id: string; extracted_text: string | null } | undefined;

  if (!master || !master.extracted_text) {
    return NextResponse.json(
      { error: "Upload a resume before importing jobs." },
      { status: 400 },
    );
  }

  // Dedup by URL first — the browser extension fires as pages render/re-render
  // (LinkedIn is an SPA), so the same posting can trigger this route more
  // than once. Also dedup by title+company: LinkedIn/Indeed URLs often carry
  // tracking params that change per page load/session, so the same job can
  // otherwise look "new" every time it's revisited even though nothing about
  // the job itself changed.
  let existingPosting = url
    ? (db.prepare("select id from job_postings where url = ?").get(url) as { id: string } | undefined)
    : undefined;

  if (!existingPosting) {
    existingPosting = db
      .prepare(
        "select id from job_postings where lower(trim(title)) = lower(trim(?)) and lower(trim(company)) = lower(trim(?))",
      )
      .get(title, company) as { id: string } | undefined;
  }

  let postingId: string;
  if (existingPosting) {
    postingId = existingPosting.id;
  } else {
    postingId = randomUUID();
    db.prepare(
      `insert into job_postings (id, source, source_site, external_id, title, company, location, description, url)
       values (?, 'manual', ?, null, ?, ?, null, ?, ?)`,
    ).run(postingId, sourceSite, title, company, description, url);
  }

  // Already applied (or saved) for this job under any resume/status — don't
  // resurface it as a new match to review again.
  const existingApplication = db
    .prepare("select id from applications where job_posting_id = ? limit 1")
    .get(postingId) as { id: string } | undefined;

  if (existingApplication) {
    return NextResponse.json({
      jobPostingId: postingId,
      applicationId: existingApplication.id,
      alreadyImported: true,
    });
  }

  const existingMatch = db
    .prepare(
      "select id, score, matching_skills, gaps, improvement_tips, summary from job_matches where job_posting_id = ? and resume_id = ?",
    )
    .get(postingId, master.id) as
    | {
        id: string;
        score: number;
        matching_skills: string;
        gaps: string;
        improvement_tips: string;
        summary: string | null;
      }
    | undefined;

  if (existingMatch) {
    return NextResponse.json({
      matchId: existingMatch.id,
      jobPostingId: postingId,
      score: existingMatch.score,
      matchingSkills: fromJson<string[]>(existingMatch.matching_skills, []),
      gaps: fromJson<string[]>(existingMatch.gaps, []),
      improvementTips: fromJson<string[]>(existingMatch.improvement_tips, []),
      summary: existingMatch.summary,
      alreadyImported: true,
    });
  }

  let match;
  try {
    match = await scoreMatch({ resumeText: master.extracted_text, title, company, description });
  } catch (err) {
    console.error("[jobs/manual-import] scoring failed", err);
    return NextResponse.json(
      { error: "Job saved, but scoring it failed. Try refreshing the Matches page later." },
      { status: 502 },
    );
  }

  const matchId = randomUUID();
  db.prepare(
    `insert into job_matches (id, job_posting_id, resume_id, score, matching_skills, gaps, improvement_tips, summary)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    matchId,
    postingId,
    master.id,
    match.score,
    toJson(match.matching_skills),
    toJson(match.gaps),
    toJson(match.improvement_tips),
    match.summary,
  );

  return NextResponse.json({
    matchId,
    jobPostingId: postingId,
    score: match.score,
    matchingSkills: match.matching_skills,
    gaps: match.gaps,
    improvementTips: match.improvement_tips,
    summary: match.summary,
  });
}
