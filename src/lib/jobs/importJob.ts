import { randomUUID } from "crypto";
import { db, toJson, fromJson } from "@/lib/db";
import { scoreMatch } from "@/lib/anthropic/scoreMatch";
import { ensureLegitimacyCheck, type LegitimacyInfo } from "@/lib/legitimacyCheck";
import { findExistingApplication } from "@/lib/applications/findExistingApplication";
import { findExistingPosting } from "@/lib/jobs/findExistingPosting";

export type ImportJobParams = {
  title: string;
  company: string;
  description: string;
  url?: string | null;
  sourceSite?: string | null;
  // Bulk imports (the search agent can pull in dozens per run) skip the
  // legitimacy check by default to avoid burning an Anthropic call per
  // result — it's still available on demand via the "Check legitimacy"
  // button once a specific match is actually being looked at.
  runLegitimacyCheck?: boolean;
};

export type ImportJobResult =
  | { ok: false; error: string; status: number }
  | {
      ok: true;
      jobPostingId: string;
      matchId?: string;
      applicationId?: string;
      score?: number;
      matchingSkills?: string[];
      gaps?: string[];
      improvementTips?: string[];
      summary?: string | null;
      isContract?: boolean;
      alreadyImported: boolean;
      legitimacy?: LegitimacyInfo | null;
    };

// Shared by manual paste-in-a-job-posting import and the automated search
// agent — same dedup, scoring, and "already tracked" short-circuit either
// way, so a job found by the agent that you'd already manually imported (or
// vice versa) never becomes a duplicate entry in Matches.
export async function importAndScoreJob(params: ImportJobParams): Promise<ImportJobResult> {
  const title = params.title.trim();
  const company = params.company.trim();
  const description = params.description.trim();
  const url = params.url?.trim() || null;
  const sourceSite = params.sourceSite ?? null;
  const runLegitimacyCheck = params.runLegitimacyCheck ?? true;

  if (!title || !company || !description) {
    return { ok: false, error: "Title, company, and description are required.", status: 400 };
  }

  const master = db
    .prepare("select id, extracted_text from resumes where is_master = 1")
    .get() as { id: string; extracted_text: string | null } | undefined;

  if (!master || !master.extracted_text) {
    return { ok: false, error: "Upload a resume before importing jobs.", status: 400 };
  }

  // Loose match first — the exact title/company dedup below only catches
  // the same literal text (a re-paste, or the extension re-firing on the
  // same page). It misses the same real job worded differently by a
  // different source (a search result vs. however you originally applied),
  // which otherwise resurfaces as "new" even though you've already applied.
  const existingApp = findExistingApplication(company, title);
  if (existingApp) {
    return { ok: true, jobPostingId: existingApp.postingId, applicationId: existingApp.id, alreadyImported: true };
  }

  let existingPosting = url
    ? (db.prepare("select id from job_postings where url = ?").get(url) as { id: string } | undefined)
    : undefined;

  if (!existingPosting) {
    existingPosting = findExistingPosting(company, title) ?? undefined;
  }

  let postingId: string;
  if (existingPosting) {
    postingId = existingPosting.id;
  } else {
    postingId = randomUUID();
    db.prepare(
      `insert into job_postings (id, source, source_site, external_id, title, company, location, description, url, created_at)
       values (?, 'manual', ?, null, ?, ?, null, ?, ?, datetime('now', 'localtime'))`,
    ).run(postingId, sourceSite, title, company, description, url);
  }

  const existingApplication = db
    .prepare("select id from applications where job_posting_id = ? limit 1")
    .get(postingId) as { id: string } | undefined;

  if (existingApplication) {
    return { ok: true, jobPostingId: postingId, applicationId: existingApplication.id, alreadyImported: true };
  }

  const existingMatch = db
    .prepare(
      "select id, score, matching_skills, gaps, improvement_tips, summary, is_contract from job_matches where job_posting_id = ? and resume_id = ?",
    )
    .get(postingId, master.id) as
    | {
        id: string;
        score: number;
        matching_skills: string;
        gaps: string;
        improvement_tips: string;
        summary: string | null;
        is_contract: number;
      }
    | undefined;

  if (existingMatch) {
    const legitimacy = runLegitimacyCheck ? await ensureLegitimacyCheck(postingId).catch(() => null) : null;
    return {
      ok: true,
      matchId: existingMatch.id,
      jobPostingId: postingId,
      score: existingMatch.score,
      matchingSkills: fromJson<string[]>(existingMatch.matching_skills, []),
      gaps: fromJson<string[]>(existingMatch.gaps, []),
      improvementTips: fromJson<string[]>(existingMatch.improvement_tips, []),
      summary: existingMatch.summary,
      isContract: Boolean(existingMatch.is_contract),
      alreadyImported: true,
      legitimacy,
    };
  }

  const [matchResult, legitimacyResult] = await Promise.allSettled([
    scoreMatch({ resumeText: master.extracted_text, title, company, description }),
    runLegitimacyCheck ? ensureLegitimacyCheck(postingId) : Promise.resolve(null),
  ]);

  if (matchResult.status === "rejected") {
    console.error("[jobs/importJob] scoring failed", matchResult.reason);
    return { ok: false, error: "Job saved, but scoring it failed.", status: 502 };
  }

  const match = matchResult.value;
  const legitimacy = legitimacyResult.status === "fulfilled" ? legitimacyResult.value : null;
  if (legitimacyResult.status === "rejected") {
    console.error("[jobs/importJob] legitimacy check failed", legitimacyResult.reason);
  }

  const matchId = randomUUID();
  db.prepare(
    `insert into job_matches (id, job_posting_id, resume_id, score, matching_skills, gaps, improvement_tips, summary, is_contract)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    matchId,
    postingId,
    master.id,
    match.score,
    toJson(match.matching_skills),
    toJson(match.gaps),
    toJson(match.improvement_tips),
    match.summary,
    match.is_contract_or_staffing ? 1 : 0,
  );

  return {
    ok: true,
    matchId,
    jobPostingId: postingId,
    score: match.score,
    matchingSkills: match.matching_skills,
    gaps: match.gaps,
    improvementTips: match.improvement_tips,
    summary: match.summary,
    isContract: match.is_contract_or_staffing,
    alreadyImported: false,
    legitimacy,
  };
}
