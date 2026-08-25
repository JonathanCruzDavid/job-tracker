import Link from "next/link";
import { db, fromJson } from "@/lib/db";
import MatchesBrowser, { type MatchData } from "@/components/MatchesBrowser";

export const dynamic = "force-dynamic";

type MatchRow = {
  id: string;
  score: number;
  matching_skills: string;
  gaps: string;
  improvement_tips: string;
  summary: string | null;
  job_posting_id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
};

export default async function MatchesPage() {
  const rows = db
    .prepare(
      `select jm.id, jm.score, jm.matching_skills, jm.gaps, jm.improvement_tips, jm.summary,
              jp.id as job_posting_id, jp.title, jp.company, jp.location, jp.url
       from job_matches jm
       join job_postings jp on jp.id = jm.job_posting_id
       where jm.status = 'new'
       order by jm.score desc`,
    )
    .all() as MatchRow[];

  const matches: MatchData[] = rows.map((row) => ({
    matchId: row.id,
    jobPostingId: row.job_posting_id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    score: row.score,
    matchingSkills: fromJson<string[]>(row.matching_skills, []),
    gaps: fromJson<string[]>(row.gaps, []),
    improvementTips: fromJson<string[]>(row.improvement_tips, []),
    summary: row.summary,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Matches to review</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Jobs scored from browsing LinkedIn/Indeed (via the browser extension) or importing
          manually land here first — save the ones worth pursuing, dismiss the rest.
        </p>
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nothing to review right now — browse LinkedIn or Indeed with the extension on, or{" "}
          <Link href="/jobs/import" className="underline">
            import a job
          </Link>{" "}
          manually.
        </p>
      ) : (
        <MatchesBrowser matches={matches} />
      )}
    </div>
  );
}
