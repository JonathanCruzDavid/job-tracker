import Link from "next/link";
import { db } from "@/lib/db";
import StatusDropdown from "@/components/StatusDropdown";
import DeleteApplicationButton from "@/components/DeleteApplicationButton";

export const dynamic = "force-dynamic";

type SavedRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  created_at: string;
  score: number | null;
  summary: string | null;
};

export default async function SavedPage() {
  const saved = db
    .prepare(
      `select a.id, a.status, jp.title, jp.company, jp.location, a.created_at, jm.score, jm.summary
       from applications a
       join job_postings jp on jp.id = a.job_posting_id
       left join job_matches jm on jm.job_posting_id = a.job_posting_id
         and jm.resume_id = (select id from resumes where is_master = 1)
       where a.status = 'saved'
       order by a.created_at desc`,
    )
    .all() as SavedRow[];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Saved</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Jobs you&apos;re considering but haven&apos;t applied to yet. Click one for the full fit
        breakdown and a tailored resume, or change its status below once you submit —
        it&apos;ll move to{" "}
        <Link href="/applications" className="underline">
          Applications
        </Link>
        .
      </p>
      {saved.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nothing saved right now — save a match from the{" "}
          <Link href="/matches" className="underline">
            Matches
          </Link>{" "}
          page.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {saved.map((job) => (
            <div
              key={job.id}
              className="rounded-md border border-black/10 p-4 dark:border-white/20"
            >
              <div className="mb-1 flex items-start justify-between gap-4">
                <Link href={`/applications/${job.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="font-medium">
                    {job.title} · {job.company}
                  </p>
                  {job.location && (
                    <p className="text-sm text-black/60 dark:text-white/60">{job.location}</p>
                  )}
                </Link>
                {job.score !== null && (
                  <span className="flex-shrink-0 rounded-full bg-black/5 px-3 py-1 text-sm font-medium dark:bg-white/10">
                    {job.score}/100
                  </span>
                )}
              </div>
              {job.summary && (
                <p className="mb-3 text-sm text-black/70 dark:text-white/70">{job.summary}</p>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black/50 dark:text-white/50">Status</span>
                  <StatusDropdown applicationId={job.id} status={job.status} />
                </div>
                <DeleteApplicationButton applicationId={job.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
