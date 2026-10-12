"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Finding = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  match_confidence: string;
  signal: "rejection" | "interview_request" | "offer" | "ack_only" | "unclear" | "not_related";
  summary: string;
};

const SIGNAL_LABEL: Record<string, string> = {
  rejection: "Looks like a rejection",
  interview_request: "Looks like an interview request",
  offer: "Looks like an offer",
  ack_only: "Just an automated acknowledgment",
  unclear: "Unclear — worth reading yourself",
};

const SIGNAL_TO_STATUS: Record<string, string> = {
  rejection: "rejected",
  interview_request: "interviewing",
  offer: "offer",
};

export default function GmailFindingsInline({
  applicationId,
  findings,
}: {
  applicationId: string;
  findings: Finding[];
}) {
  const router = useRouter();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDismiss(emailId: string) {
    setDismissedIds((prev) => new Set(prev).add(emailId));
    await fetch("/api/gmail/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, emailId }),
    });
    router.refresh();
  }

  async function handleMark(emailId: string, status: string) {
    setBusy(emailId);
    const res = await fetch(`/api/applications/${applicationId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (res.ok) {
      await handleDismiss(emailId);
    }
  }

  const visible = findings.filter((f) => !dismissedIds.has(f.id));

  if (visible.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
        📬 Gmail findings
      </h2>
      <div className="flex flex-col gap-3">
        {visible.map((finding) => {
          const status = SIGNAL_TO_STATUS[finding.signal];
          return (
            <div
              key={finding.id}
              className="rounded-md border border-amber-600/30 bg-amber-600/5 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/5"
            >
              <p className="font-medium">{SIGNAL_LABEL[finding.signal] ?? finding.signal}</p>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                {finding.subject} — from {finding.from} — {finding.date}
              </p>
              <p className="mt-1 text-black/70 dark:text-white/70">{finding.summary}</p>
              <p className="mt-1 text-xs italic text-black/50 dark:text-white/50">
                &ldquo;{finding.snippet}&rdquo;
              </p>
              <div className="mt-2 flex gap-2">
                {status && (
                  <button
                    onClick={() => handleMark(finding.id, status)}
                    disabled={busy === finding.id}
                    className="rounded-md border border-black/10 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20"
                  >
                    {busy === finding.id ? "Updating..." : `Mark application as "${status}"`}
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(finding.id)}
                  className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/20"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
