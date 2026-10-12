import Link from "next/link";
import { db } from "@/lib/db";
import StatusDropdown from "@/components/StatusDropdown";
import InlineField from "@/components/InlineField";
import DeleteApplicationButton from "@/components/DeleteApplicationButton";
import DisconnectGmailButton from "@/components/DisconnectGmailButton";
import RefreshGmailButton from "@/components/RefreshGmailButton";
import { getUndismissedFindingCounts } from "@/lib/gmail/emailReviews";
import { isGhosted, GHOSTED_AFTER_DAYS } from "@/lib/applications/ghosted";
import { isGmailConnected, getConnectedEmail, getLastCheckedAt } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

const GMAIL_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google didn't return an authorization code — try connecting again.",
  no_refresh_token:
    "Google didn't return a refresh token. Try disconnecting any prior access at myaccount.google.com/permissions and reconnecting.",
  exchange_failed: "Something went wrong exchanging the authorization code — check the server logs.",
  access_denied: "You declined access — nothing was connected.",
};

type ApplicationRow = {
  id: string;
  status: string;
  interview_stage: string | null;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
  responded_at: string | null;
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

function timeToHearBack(appliedAt: string | null, respondedAt: string | null): string {
  if (!appliedAt) return "—";
  if (!respondedAt) return "Pending";
  const days = Math.round(
    (new Date(respondedAt).getTime() - new Date(appliedAt).getTime()) / 86_400_000,
  );
  if (days <= 0) return "Same day";
  return days === 1 ? "1 day" : `${days} days`;
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

const STATUS_FILTERS = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; connected?: string; error?: string }>;
}) {
  const { status: statusFilter, connected: justConnected, error: gmailError } = await searchParams;
  const activeFilter =
    statusFilter && (STATUS_FILTERS as readonly string[]).includes(statusFilter)
      ? statusFilter
      : null;

  const gmailConnected = isGmailConnected();
  const gmailEmail = getConnectedEmail();
  const gmailLastChecked = getLastCheckedAt();

  const applications = db
    .prepare(
      `select a.id, a.status, a.interview_stage, a.notes, a.created_at,
              jp.title, jp.company, jp.source, jp.source_site, jp.url,
              (
                select e.created_at from application_events e
                where e.application_id = a.id and e.event_type = 'status_change' and e.to_status = 'applied'
                order by e.created_at asc limit 1
              ) as applied_at,
              (
                select min(e2.created_at) from application_events e2
                where e2.application_id = a.id and e2.event_type = 'status_change'
                  and e2.created_at > (
                    select e1.created_at from application_events e1
                    where e1.application_id = a.id and e1.event_type = 'status_change' and e1.to_status = 'applied'
                    order by e1.created_at asc limit 1
                  )
              ) as responded_at
       from applications a
       join job_postings jp on jp.id = a.job_posting_id
       where (? is null or a.status = ?)
       order by a.created_at desc`,
    )
    .all(activeFilter, activeFilter) as ApplicationRow[];

  const statusCounts = db
    .prepare("select status, count(*) as count from applications group by status")
    .all() as { status: string; count: number }[];
  const countFor = (status: string) => statusCounts.find((r) => r.status === status)?.count ?? 0;
  const totalCount = statusCounts.reduce((sum, r) => sum + r.count, 0);

  const findingCounts = getUndismissedFindingCounts();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
      </div>

      {gmailError && (
        <div className="mb-6 rounded-md border border-red-600/30 bg-red-600/5 p-4 text-sm text-red-700 dark:text-red-400">
          {GMAIL_ERROR_MESSAGES[gmailError] ?? `Gmail connection failed: ${gmailError}`}
        </div>
      )}
      {justConnected === "1" && (
        <div className="mb-6 rounded-md border border-green-600/30 bg-green-600/5 p-4 text-sm text-green-700 dark:text-green-400">
          Gmail connected — click &quot;Refresh now&quot; below whenever you want to check for new
          applications and replies.
        </div>
      )}
      <div className="mb-6 flex items-center justify-between rounded-md border border-black/10 p-3 text-sm dark:border-white/20">
        {gmailConnected ? (
          <>
            <div>
              <span className="text-black/70 dark:text-white/70">
                Gmail connected as <span className="font-medium">{gmailEmail}</span>
              </span>
              <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                {gmailLastChecked
                  ? `last checked ${new Date(gmailLastChecked).toLocaleString()}`
                  : "not checked yet — click Refresh"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <RefreshGmailButton />
              <DisconnectGmailButton />
            </div>
          </>
        ) : (
          <>
            <span className="text-black/70 dark:text-white/70">
              Connect Gmail to import applications and replies with one click whenever you want to
              check.
            </span>
            <a href="/api/gmail/connect" className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background">
              Connect Gmail
            </a>
          </>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/applications"
          className={`rounded-full px-3 py-1 ${
            activeFilter === null
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
          }`}
        >
          All ({totalCount})
        </Link>
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={`/applications?status=${s}`}
            className={`rounded-full px-3 py-1 capitalize ${
              activeFilter === s
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
            }`}
          >
            {s} ({countFor(s)})
          </Link>
        ))}
      </div>
      {applications.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          {activeFilter
            ? `Nothing with status "${activeFilter}" right now.`
            : "Nothing here yet — save a match from the Matches page, or it'll show up automatically once Gmail picks up an application."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-black/10 text-left text-black/50 dark:border-white/20 dark:text-white/50">
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Company</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Applied</th>
                <th className="py-2 pr-4 font-medium">Time to hear back</th>
                <th className="py-2 pr-4 font-medium">Heard back?</th>
                <th className="py-2 pr-4 font-medium">Moved on?</th>
                <th className="py-2 pr-4 font-medium">Interview stage</th>
                <th className="py-2 pr-4 font-medium">Notes</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className={
                    app.status === "rejected"
                      ? "border-b border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"
                      : "border-b border-black/5 dark:border-white/10"
                  }
                >
                  <td className="py-3 pr-4">
                    {app.title}
                    {findingCounts.has(app.id) && (
                      <Link
                        href={`/applications/${app.id}`}
                        className="ml-2 whitespace-nowrap rounded-full bg-amber-600/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                      >
                        📬 {findingCounts.get(app.id)}
                      </Link>
                    )}
                  </td>
                  <td className="py-3 pr-4">{app.company}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <StatusDropdown applicationId={app.id} status={app.status} />
                      {isGhosted(app.status, app.applied_at) && (
                        <span
                          title={`No response ${GHOSTED_AFTER_DAYS / 7}+ weeks after applying`}
                          className="whitespace-nowrap rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60"
                        >
                          👻 Ghosted
                        </span>
                      )}
                    </div>
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
                  <td className="py-3 pr-4 text-black/60 dark:text-white/60">
                    {timeToHearBack(app.applied_at, app.responded_at)}
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
                  <td className="py-3">
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
