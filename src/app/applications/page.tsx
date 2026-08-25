import Link from "next/link";
import { db } from "@/lib/db";
import StatusDropdown from "@/components/StatusDropdown";
import InlineField from "@/components/InlineField";
import DeleteApplicationButton from "@/components/DeleteApplicationButton";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  status: string;
  interview_stage: string | null;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
  title: string;
  company: string;
  source: string;
  source_site: string | null;
  url: string | null;
};

function heardBack(status: string): string {
  if (status === "withdrawn") return "—";
  if (status === "saved" || status === "applied") return "No";
  return "Yes";
}

function movedOn(status: string): string {
  return status === "rejected" || status === "withdrawn" ? "Yes" : "No";
}

function sourceLabel(row: ApplicationRow): string {
  if (row.source_site) return row.source_site;
  if (row.source === "adzuna") return "Adzuna";
  if (row.source === "remoteok") return "RemoteOK";
  return "Manual";
}

export default async function ApplicationsPage() {
  const applications = db
    .prepare(
      `select a.id, a.status, a.interview_stage, a.notes, a.created_at,
              jp.title, jp.company, jp.source, jp.source_site, jp.url,
              (
                select e.created_at from application_events e
                where e.application_id = a.id and e.event_type = 'status_change' and e.to_status = 'applied'
                order by e.created_at asc limit 1
              ) as applied_at
       from applications a
       join job_postings jp on jp.id = a.job_posting_id
       where a.status != 'saved'
       order by a.created_at desc`,
    )
    .all() as ApplicationRow[];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Applications</h1>
      {applications.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nothing in progress yet — move a job from{" "}
          <Link href="/saved" className="underline">
            Saved
          </Link>{" "}
          to &quot;applied&quot; once you actually submit it.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-black/50 dark:border-white/20 dark:text-white/50">
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Company</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Applied</th>
                <th className="py-2 pr-4 font-medium">Heard back?</th>
                <th className="py-2 pr-4 font-medium">Moved on?</th>
                <th className="py-2 pr-4 font-medium">Interview stage</th>
                <th className="py-2 pr-4 font-medium">Notes</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-3 pr-4">{app.title}</td>
                  <td className="py-3 pr-4">{app.company}</td>
                  <td className="py-3 pr-4">
                    <StatusDropdown applicationId={app.id} status={app.status} />
                  </td>
                  <td className="py-3 pr-4 text-black/60 dark:text-white/60">
                    {app.applied_at ? (
                      <>
                        {new Date(app.applied_at).toLocaleDateString()} via{" "}
                        {app.url ? (
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {sourceLabel(app)}
                          </a>
                        ) : (
                          sourceLabel(app)
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4">{heardBack(app.status)}</td>
                  <td className="py-3 pr-4">{movedOn(app.status)}</td>
                  <td className="py-3 pr-4">
                    <InlineField
                      applicationId={app.id}
                      endpoint="interview-stage"
                      bodyKey="interviewStage"
                      initialValue={app.interview_stage}
                      placeholder="e.g. Phone screen"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <InlineField
                      applicationId={app.id}
                      endpoint="notes"
                      bodyKey="notes"
                      initialValue={app.notes}
                      placeholder="Add a note..."
                    />
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <Link href={`/applications/${app.id}`} className="underline">
                      Details
                    </Link>
                    <span className="mx-2 text-black/20 dark:text-white/20">·</span>
                    <DeleteApplicationButton applicationId={app.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
