import Link from "next/link";
import { db } from "@/lib/db";
import ApplicationsCalendar, { type CalendarApplication } from "@/components/ApplicationsCalendar";
import StatusBreakdownChart, { type StatusSegment } from "@/components/StatusBreakdownChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const master = db
    .prepare("select id, file_name from resumes where is_master = 1")
    .get() as { id: string; file_name: string } | undefined;

  const { count: newMatchCount } = db
    .prepare("select count(*) as count from job_matches where status = 'new'")
    .get() as { count: number };

  const { count: totalApplied } = db
    .prepare("select count(*) as count from applications where status != 'saved'")
    .get() as { count: number };

  const { count: savedCount } = db
    .prepare("select count(*) as count from applications where status = 'saved'")
    .get() as { count: number };

  // Calendar day comes from the status_change event log (when the status
  // actually flipped to "applied"), not the application's created_at
  // (which is when it was first saved from a match, possibly days before
  // actually applying). Falls back to created_at for the rare case an
  // application skipped straight past "applied" (e.g. marked rejected
  // directly from saved).
  const calendarApplications = (
    db
      .prepare(
        `select a.id, jp.title, jp.company, a.status,
                coalesce(
                  (select min(date(e.created_at)) from application_events e
                   where e.application_id = a.id and e.event_type = 'status_change' and e.to_status = 'applied'),
                  date(a.created_at)
                ) as date
         from applications a
         join job_postings jp on jp.id = a.job_posting_id
         where a.status != 'saved'`,
      )
      .all() as CalendarApplication[]
  ).map((row) => ({ ...row }));

  const statusCounts = db
    .prepare(
      `select status, count(*) as count from applications where status != 'saved' group by status`,
    )
    .all() as { status: string; count: number }[];

  function countFor(statuses: string[]): number {
    return statusCounts
      .filter((r) => statuses.includes(r.status))
      .reduce((sum, r) => sum + r.count, 0);
  }

  const statusSegments: StatusSegment[] = [
    { label: "Submitted, no response yet", count: countFor(["applied"]), colorClass: "bg-blue-500" },
    {
      label: "Heard back (interviewing/offer)",
      count: countFor(["interviewing", "offer"]),
      colorClass: "bg-green-500",
    },
    { label: "Rejected", count: countFor(["rejected"]), colorClass: "bg-red-500" },
  ];
  const withdrawnCount = countFor(["withdrawn"]);
  if (withdrawnCount > 0) {
    statusSegments.push({ label: "Withdrawn", count: withdrawnCount, colorClass: "bg-gray-400" });
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      {!master && (
        <div className="mb-6 rounded-md border border-amber-600/30 bg-amber-600/5 p-4 text-sm">
          You haven&apos;t uploaded a resume yet.{" "}
          <Link href="/resumes" className="underline">
            Upload one
          </Link>{" "}
          before importing or matching jobs.
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/applications"
          className="rounded-md border border-black/10 p-4 dark:border-white/20"
        >
          <p className="text-2xl font-semibold">{totalApplied ?? 0}</p>
          <p className="text-sm text-black/60 dark:text-white/60">Total jobs applied to</p>
        </Link>
        <Link href="/saved" className="rounded-md border border-black/10 p-4 dark:border-white/20">
          <p className="text-2xl font-semibold">{savedCount ?? 0}</p>
          <p className="text-sm text-black/60 dark:text-white/60">Saved, not yet applied</p>
        </Link>
        <Link
          href="/matches"
          className="rounded-md border border-black/10 p-4 dark:border-white/20"
        >
          <p className="text-2xl font-semibold">{newMatchCount ?? 0}</p>
          <p className="text-sm text-black/60 dark:text-white/60">New matches to review</p>
        </Link>
        <Link
          href="/jobs/import"
          className="rounded-md border border-black/10 p-4 dark:border-white/20"
        >
          <p className="font-medium">Import a job</p>
          <p className="text-sm text-black/60 dark:text-white/60">
            Paste a posting you found yourself
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
            Applications by day
          </h2>
          {calendarApplications.length === 0 ? (
            <p className="text-sm text-black/60 dark:text-white/60">
              Nothing yet — once you mark a job &quot;applied&quot; on the{" "}
              <Link href="/applications" className="underline">
                Applications
              </Link>{" "}
              page, it&apos;ll show up here.
            </p>
          ) : (
            <ApplicationsCalendar applications={calendarApplications} />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
            Response status
          </h2>
          <StatusBreakdownChart segments={statusSegments} />
        </section>
      </div>
    </div>
  );
}
