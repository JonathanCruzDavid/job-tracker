import { db, toJson, fromJson } from "@/lib/db";
import { checkJobLegitimacy } from "@/lib/anthropic/checkLegitimacy";

export type LegitimacyInfo = {
  scamVerdict: string | null;
  scamRiskScore: number | null;
  scamRedFlags: string[];
  scamReasoning: string | null;
};

type PostingRow = {
  title: string;
  company: string;
  description: string | null;
  url: string | null;
  source_site: string | null;
  scam_verdict: string | null;
  scam_risk_score: number | null;
  scam_red_flags: string | null;
  scam_reasoning: string | null;
};

function toInfo(row: PostingRow): LegitimacyInfo {
  return {
    scamVerdict: row.scam_verdict,
    scamRiskScore: row.scam_risk_score,
    scamRedFlags: fromJson<string[]>(row.scam_red_flags, []),
    scamReasoning: row.scam_reasoning,
  };
}

// Cached on the posting itself (not per-match) since legitimacy is a property
// of the job/company, not of how well it fits any particular resume. Pass
// force=true to re-run even if already checked (used by the manual "recheck"
// button, e.g. for postings imported before this feature existed).
export async function ensureLegitimacyCheck(
  jobPostingId: string,
  force = false,
): Promise<LegitimacyInfo> {
  const posting = db
    .prepare(
      `select title, company, description, url, source_site,
              scam_verdict, scam_risk_score, scam_red_flags, scam_reasoning
       from job_postings where id = ?`,
    )
    .get(jobPostingId) as PostingRow | undefined;

  if (!posting) {
    throw new Error("Job posting not found");
  }

  if (posting.scam_verdict && !force) {
    return toInfo(posting);
  }

  const result = await checkJobLegitimacy({
    title: posting.title,
    company: posting.company,
    description: posting.description ?? "",
    url: posting.url,
    sourceSite: posting.source_site,
  });

  db.prepare(
    `update job_postings
     set scam_verdict = ?, scam_risk_score = ?, scam_red_flags = ?, scam_reasoning = ?
     where id = ?`,
  ).run(result.verdict, result.risk_score, toJson(result.red_flags), result.reasoning, jobPostingId);

  return {
    scamVerdict: result.verdict,
    scamRiskScore: result.risk_score,
    scamRedFlags: result.red_flags,
    scamReasoning: result.reasoning,
  };
}
