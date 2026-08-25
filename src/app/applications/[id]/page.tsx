import { notFound } from "next/navigation";
import { db, fromJson } from "@/lib/db";
import StatusDropdown from "@/components/StatusDropdown";
import NotesEditor from "@/components/NotesEditor";
import InlineField from "@/components/InlineField";
import ApplicationTimeline from "@/components/ApplicationTimeline";
import TailoredResumePreview from "@/components/TailoredResumePreview";
import DeleteApplicationButton from "@/components/DeleteApplicationButton";

export const dynamic = "force-dynamic";

type ApplicationDetailRow = {
  id: string;
  status: string;
  notes: string | null;
  interview_stage: string | null;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  description: string | null;
  source: string;
  source_site: string | null;
  applied_at: string | null;
  score: number | null;
  matching_skills: string | null;
  gaps: string | null;
  improvement_tips: string | null;
  summary: string | null;
};

function sourceLabel(row: ApplicationDetailRow): string {
  if (row.source_site) return row.source_site;
  if (row.source === "adzuna") return "Adzuna";
  if (row.source === "remoteok") return "RemoteOK";
  return "Manual";
}

type EventRow = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  resume_id: string | null;
  created_at: string;
};

export default async function ApplicationDetailPage({
  params,
}: PageProps<"/applications/[id]">) {
  const { id } = await params;

  const application = db
    .prepare(
      `select a.id, a.status, a.notes, a.interview_stage,
              jp.title, jp.company, jp.location, jp.url, jp.description, jp.source, jp.source_site,
              (
                select e.created_at from application_events e
                where e.application_id = a.id and e.event_type = 'status_change' and e.to_status = 'applied'
                order by e.created_at asc limit 1
              ) as applied_at,
              jm.score, jm.matching_skills, jm.gaps, jm.improvement_tips, jm.summary
       from applications a
       join job_postings jp on jp.id = a.job_posting_id
       left join job_matches jm on jm.job_posting_id = a.job_posting_id
         and jm.resume_id = (select id from resumes where is_master = 1)
       where a.id = ?`,
    )
    .get(id) as ApplicationDetailRow | undefined;

  if (!application) {
    notFound();
  }

  const events = db
    .prepare(
      "select id, event_type, from_status, to_status, note, resume_id, created_at from application_events where application_id = ? order by created_at desc",
    )
    .all(id) as EventRow[];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{application.title}</h1>
          <p className="text-black/60 dark:text-white/60">
            {application.company}
            {application.location ? ` · ${application.location}` : ""}
          </p>
          {application.url && (
            <a href={application.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              View original posting
            </a>
          )}
          {application.applied_at && (
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              Applied {new Date(application.applied_at).toLocaleDateString()} via{" "}
              {sourceLabel(application)}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <StatusDropdown applicationId={application.id} status={application.status} />
          <DeleteApplicationButton
            applicationId={application.id}
            redirectTo={application.status === "saved" ? "/saved" : "/applications"}
          />
        </div>
      </div>

      {application.description && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
            Job description
          </h2>
          <div className="max-h-64 overflow-y-auto rounded-md border border-black/10 p-4 dark:border-white/20">
            <p className="whitespace-pre-line text-sm text-black/70 dark:text-white/70">
              {application.description}
            </p>
          </div>
        </section>
      )}

      {application.score !== null && (
        <section className="mb-8 rounded-md border border-black/10 p-4 dark:border-white/20">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
              Why you&apos;d be a fit (or not)
            </h2>
            <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium dark:bg-white/10">
              {application.score}/100
            </span>
          </div>
          {application.summary && (
            <p className="mb-3 text-sm text-black/70 dark:text-white/70">{application.summary}</p>
          )}
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fromJson<string[]>(application.matching_skills, []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-black/50 dark:text-white/50">Matching</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {fromJson<string[]>(application.matching_skills, []).map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>
            )}
            {fromJson<string[]>(application.gaps, []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-black/50 dark:text-white/50">Gaps</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {fromJson<string[]>(application.gaps, []).map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {fromJson<string[]>(application.improvement_tips, []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-black/50 dark:text-white/50">
                Would updating your resume help?
              </p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {fromJson<string[]>(application.improvement_tips, []).map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                See the &quot;Tailored resume&quot; section below for what a better resume for
                this specific job would actually look like.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
          Interview stage
        </h2>
        <InlineField
          applicationId={application.id}
          endpoint="interview-stage"
          bodyKey="interviewStage"
          initialValue={application.interview_stage}
          placeholder="e.g. Phone screen, Onsite round 2, Final round..."
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">Notes</h2>
        <NotesEditor applicationId={application.id} initialNotes={application.notes} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
          Tailored resume
        </h2>
        <TailoredResumePreview applicationId={application.id} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">Timeline</h2>
        <ApplicationTimeline events={events} />
      </section>
    </div>
  );
}
