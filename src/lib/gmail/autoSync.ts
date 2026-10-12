import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { isGmailConnected } from "./client";
import { searchApplicationEmails } from "./searchApplicationEmails";
import { searchRepliesForCompany } from "./searchReplies";
import { extractApplicationFromEmail } from "@/lib/anthropic/extractApplicationFromEmail";
import { classifyEmailReply } from "@/lib/anthropic/classifyEmailReply";
import { getCachedReview, saveReview, dismissReview } from "./emailReviews";
import { findExistingApplication } from "@/lib/applications/findExistingApplication";
import { findExistingPosting } from "@/lib/jobs/findExistingPosting";
import { setApplicationStatus, STATUS_RANK } from "@/lib/applications/statusTransitions";
import { toLocalSqliteDateTime } from "@/lib/dateFormat";

// What an extracted email outcome implies for a brand-new application
// (mirrors the old manual "scan for missed updates" + "confirm" flow, now
// run automatically with no review step in between).
const OUTCOME_TARGET_STATUS: Record<string, string> = {
  confirmation: "applied",
  interview_request: "interviewing",
  offer: "offer",
  rejection: "rejected",
};

// Only a reply with an unambiguous target status gets auto-applied.
// "unclear" and "ack_only" have no safe automatic action, so they're left
// for a human via the existing Gmail-findings badge/inline UI.
const SIGNAL_TO_STATUS: Record<string, string> = {
  rejection: "rejected",
  interview_request: "interviewing",
  offer: "offer",
};

function toSqliteDateTime(rfc2822: string): string {
  const parsed = new Date(rfc2822);
  return toLocalSqliteDateTime(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
}

// Module-level, not persisted — only needed to stop two overlapping runs on
// the same long-lived `next dev` process, not across restarts.
let syncInFlight = false;

// Only ever called from the manual "Refresh now" button — there is no
// automatic/throttled trigger, by design. `syncInFlight` just guards against
// a double-click firing two overlapping runs.
export async function runGmailAutoSync(): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;
  db.prepare("update gmail_connection set last_checked_at = datetime('now', 'localtime') where id = 1").run();

  try {
    await autoImportNewApplications();
    await autoApplyReplies();
  } catch (err) {
    console.error("[gmail/autoSync] failed", err);
  } finally {
    syncInFlight = false;
  }
}

async function autoImportNewApplications(): Promise<void> {
  const emails = await searchApplicationEmails();

  const alreadySeen = new Set(
    (db.prepare("select email_id from gmail_application_candidates").all() as { email_id: string }[]).map(
      (r) => r.email_id,
    ),
  );

  const insertCandidate = db.prepare(
    `insert into gmail_application_candidates
       (email_id, subject, from_address, email_date, snippet, extracted_company, extracted_title, extracted_outcome, is_application, status)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const email of emails) {
    if (alreadySeen.has(email.id)) continue;

    let extraction;
    try {
      extraction = await extractApplicationFromEmail(email);
    } catch (err) {
      console.error("[gmail/autoSync] extraction failed", err);
      continue; // not inserted — retried automatically on the next sync
    }

    const targetStatus = OUTCOME_TARGET_STATUS[extraction.outcome];
    const isRealCandidate = Boolean(targetStatus && extraction.company);

    let isActionable = false;
    const existing = isRealCandidate
      ? findExistingApplication(extraction.company!, extraction.title)
      : null;
    if (isRealCandidate) {
      isActionable = !existing || STATUS_RANK[existing.status] < STATUS_RANK[targetStatus];
    }

    insertCandidate.run(
      email.id,
      email.subject,
      email.from,
      email.date,
      email.snippet,
      extraction.company,
      extraction.title,
      extraction.outcome,
      isRealCandidate ? 1 : 0,
      isRealCandidate && isActionable ? "confirmed" : "dismissed",
    );

    if (!isRealCandidate || !isActionable) continue;

    const company = extraction.company!;
    const title = extraction.title || "(role not specified)";
    const backdatedAt = toSqliteDateTime(email.date);

    if (existing) {
      // Fills in a real title once one is finally known, for a posting that
      // was first created from a title-less email (see the placeholder match
      // above) — otherwise it would display as "(role not specified)" forever
      // even after a later email reveals the actual role.
      if (extraction.title) {
        db.prepare(
          "update job_postings set title = ? where id = ? and title = '(role not specified)'",
        ).run(extraction.title, existing.postingId);
      }
      if (STATUS_RANK[existing.status] < STATUS_RANK[targetStatus]) {
        setApplicationStatus(existing.id, existing.status, targetStatus, backdatedAt);
      }
      continue;
    }

    const existingPosting = extraction.title ? findExistingPosting(company, extraction.title) : null;
    let postingId: string;
    if (existingPosting) {
      postingId = existingPosting.id;
    } else {
      postingId = randomUUID();
      db.prepare(
        `insert into job_postings (id, source, source_site, external_id, title, company, location, description, url, created_at)
         values (?, 'manual', ?, null, ?, ?, null, null, null, datetime('now', 'localtime'))`,
      ).run(postingId, "Gmail", title, company);
    }

    const applicationId = randomUUID();
    db.prepare(
      `insert into applications (id, job_posting_id, status, created_at, updated_at)
       values (?, ?, 'saved', ?, datetime('now', 'localtime'))`,
    ).run(applicationId, postingId, backdatedAt);

    setApplicationStatus(applicationId, "saved", targetStatus, backdatedAt);
  }
}

async function autoApplyReplies(): Promise<void> {
  const applications = db
    .prepare(
      `select a.id, jp.title, jp.company,
              (
                select min(e.created_at) from application_events e
                where e.application_id = a.id and e.event_type = 'status_change' and e.to_status = 'applied'
              ) as applied_at
       from applications a
       join job_postings jp on jp.id = a.job_posting_id
       where a.status in ('applied', 'interviewing')`,
    )
    .all() as { id: string; title: string; company: string; applied_at: string | null }[];

  for (const app of applications) {
    let candidates;
    try {
      candidates = await searchRepliesForCompany(app.company, app.applied_at);
    } catch (err) {
      console.error(`[gmail/autoSync] reply search failed for ${app.company}`, err);
      continue;
    }

    for (const email of candidates) {
      const cached = getCachedReview(email.id, app.id);
      let classification: { match_confidence: string; signal: string };

      if (cached) {
        if (cached.dismissed) continue;
        classification = { match_confidence: cached.match_confidence, signal: cached.signal };
      } else {
        try {
          const result = await classifyEmailReply({
            company: app.company,
            title: app.title,
            appliedAt: app.applied_at,
            subject: email.subject,
            from: email.from,
            date: email.date,
            snippet: email.snippet,
          });
          saveReview(email, app.id, result);
          classification = result;
        } catch (err) {
          console.error("[gmail/autoSync] classification failed", err);
          continue;
        }
      }

      if (classification.match_confidence === "none" || classification.signal === "not_related") continue;

      const targetStatus = SIGNAL_TO_STATUS[classification.signal];
      if (!targetStatus) continue; // "unclear"/"ack_only" — left for manual review

      // Re-read current status each time: an earlier candidate in this same
      // run may have already moved it forward.
      const current = db.prepare("select status from applications where id = ?").get(app.id) as
        | { status: string }
        | undefined;
      if (!current || STATUS_RANK[current.status] >= STATUS_RANK[targetStatus]) continue;

      setApplicationStatus(app.id, current.status, targetStatus);
      dismissReview(email.id, app.id);
    }
  }
}
