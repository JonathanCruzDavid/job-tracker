import { db } from "@/lib/db";
import type { CandidateEmail } from "./searchReplies";
import type { EmailClassification } from "@/lib/anthropic/classifyEmailReply";

export type ReviewedCandidate = CandidateEmail & EmailClassification;

type ReviewRow = {
  match_confidence: string;
  signal: string;
  summary: string;
  subject: string;
  from_address: string;
  email_date: string;
  snippet: string;
  dismissed: number;
};

// Classification never changes for a given email — an already-reviewed pair
// is either reused as-is (cheap, no Anthropic call) or skipped entirely if
// the user dismissed it, rather than re-classified every check.
export function getCachedReview(emailId: string, applicationId: string): ReviewRow | undefined {
  return db
    .prepare(
      `select match_confidence, signal, summary, subject, from_address, email_date, snippet, dismissed
       from gmail_email_reviews where email_id = ? and application_id = ?`,
    )
    .get(emailId, applicationId) as ReviewRow | undefined;
}

export function saveReview(
  email: CandidateEmail,
  applicationId: string,
  classification: EmailClassification,
): void {
  db.prepare(
    `insert into gmail_email_reviews
       (email_id, application_id, match_confidence, signal, summary, subject, from_address, email_date, snippet)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(email_id, application_id) do nothing`,
  ).run(
    email.id,
    applicationId,
    classification.match_confidence,
    classification.signal,
    classification.summary,
    email.subject,
    email.from,
    email.date,
    email.snippet,
  );
}

export function dismissReview(emailId: string, applicationId: string): void {
  db.prepare(
    "update gmail_email_reviews set dismissed = 1 where email_id = ? and application_id = ?",
  ).run(emailId, applicationId);
}

export function rowToCandidate(email: CandidateEmail, row: ReviewRow): ReviewedCandidate {
  return {
    ...email,
    match_confidence: row.match_confidence as EmailClassification["match_confidence"],
    signal: row.signal as EmailClassification["signal"],
    summary: row.summary,
  };
}

// "Actionable" is deliberately narrower than what /gmail's manual check
// shows — that page surfaces everything not obviously irrelevant (including
// ack_only auto-replies), which is useful when you're already looking. But
// for badges/counts meant to mean "something needs your attention," an
// automated "we received your application" confirmation is just noise —
// only a real status signal or something genuinely ambiguous should count.
const ACTIONABLE_FILTER = "signal in ('rejection', 'interview_request', 'offer', 'unclear')";

// Un-dismissed, actionable findings per application — used to surface "you
// have a reply to review" badges without re-hitting the Gmail API on every
// page load. Only reflects what a past "Check for replies" run already found.
export function getUndismissedFindingCounts(): Map<string, number> {
  const rows = db
    .prepare(
      `select application_id, count(*) as count
       from gmail_email_reviews
       where dismissed = 0 and ${ACTIONABLE_FILTER}
       group by application_id`,
    )
    .all() as { application_id: string; count: number }[];
  return new Map(rows.map((r) => [r.application_id, r.count]));
}

export function getUndismissedFindingsForApplication(applicationId: string): ReviewedCandidate[] {
  return db
    .prepare(
      `select email_id as id, subject, from_address as from_field, email_date as date, snippet,
              match_confidence, signal, summary
       from gmail_email_reviews
       where application_id = ? and dismissed = 0 and ${ACTIONABLE_FILTER}
       order by created_at desc`,
    )
    .all(applicationId)
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        subject: r.subject as string,
        from: r.from_field as string,
        date: r.date as string,
        snippet: r.snippet as string,
        match_confidence: r.match_confidence as EmailClassification["match_confidence"],
        signal: r.signal as EmailClassification["signal"],
        summary: r.summary as string,
      };
    });
}

export function getTotalUndismissedFindings(): number {
  const row = db
    .prepare(
      `select count(*) as count from gmail_email_reviews ger
       join applications a on a.id = ger.application_id
       where ger.dismissed = 0 and ${ACTIONABLE_FILTER.replace(/\bsignal\b/g, "ger.signal")}
         and a.status in ('applied', 'interviewing')`,
    )
    .get() as { count: number };
  return row.count;
}
