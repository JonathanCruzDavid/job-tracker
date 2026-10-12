import { randomUUID } from "crypto";
import { db } from "@/lib/db";

// Lets "did this email move things forward" be answered with a simple
// number comparison instead of an explicit transition table. rejected and
// withdrawn share the top rank since both are terminal — neither should be
// clobbered by a stale, lower-signal email arriving later.
export const STATUS_RANK: Record<string, number> = {
  saved: 0,
  applied: 1,
  interviewing: 2,
  offer: 3,
  rejected: 4,
  withdrawn: 4,
};

// Shared by the manual status-change route and the Gmail-confirmed
// auto-tracking flow, so both go through the exact same event-logging — the
// only difference is whether the event is timestamped "now" (manual) or
// backdated to when the email actually arrived (Gmail-confirmed).
export function setApplicationStatus(
  applicationId: string,
  fromStatus: string,
  toStatus: string,
  eventCreatedAt?: string,
): void {
  // Same status in and out isn't a real transition — skip it rather than
  // logging a from==to event (would otherwise double-count on the
  // dashboard calendar, e.g. if something re-confirms an already-applied
  // status).
  if (fromStatus === toStatus) return;

  db.prepare("update applications set status = ?, updated_at = datetime('now', 'localtime') where id = ?").run(
    toStatus,
    applicationId,
  );

  db.prepare(
    `insert into application_events (id, application_id, event_type, from_status, to_status, created_at)
     values (?, ?, 'status_change', ?, ?, coalesce(?, datetime('now', 'localtime')))`,
  ).run(randomUUID(), applicationId, fromStatus, toStatus, eventCreatedAt ?? null);
}
