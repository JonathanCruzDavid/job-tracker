"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TailoredResumePreview from "./TailoredResumePreview";

const GOOD_CHANCE_THRESHOLD = 65;

type Props = {
  matchId: string;
  jobPostingId: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  score: number;
  matchingSkills: string[];
  gaps: string[];
  improvementTips: string[];
  summary: string | null;
};

export default function JobMatchCard({
  matchId,
  title,
  company,
  location,
  url,
  score,
  matchingSkills,
  gaps,
  improvementTips,
  summary,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  async function handleAction(action: "save" | "dismiss") {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/matches/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => ({}));

    setBusy(false);

    if (!res.ok) {
      setError(body?.error ?? "Something went wrong.");
      return;
    }

    if (action === "dismiss") {
      setDismissed(true);
    } else {
      setApplicationId(body.applicationId);
    }
    router.refresh();
  }

  if (dismissed) {
    return null;
  }

  return (
    <div className="rounded-md border border-black/10 p-4 dark:border-white/20">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {title} · {company}
          </p>
          {location && <p className="text-sm text-black/60 dark:text-white/60">{location}</p>}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              View posting
            </a>
          )}
        </div>
        <span className="flex-shrink-0 rounded-full bg-black/5 px-3 py-1 text-sm font-medium dark:bg-white/10">
          {score}/100
        </span>
      </div>
      {summary && <p className="mb-2 text-sm text-black/70 dark:text-white/70">{summary}</p>}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {matchingSkills.length > 0 && (
          <div>
            <p className="text-xs font-medium text-black/50 dark:text-white/50">Matching</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {matchingSkills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
        )}
        {gaps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-black/50 dark:text-white/50">Gaps</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {improvementTips.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-black/50 dark:text-white/50">
            How to improve your chances
          </p>
          <ul className="mt-1 list-inside list-disc text-sm">
            {improvementTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {!applicationId ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction("save")}
            disabled={busy}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
          >
            {score >= GOOD_CHANCE_THRESHOLD ? "Save & track" : "Save"}
          </button>
          <button
            onClick={() => handleAction("dismiss")}
            disabled={busy}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="border-t border-black/10 pt-3 dark:border-white/20">
          <p className="mb-2 text-sm text-green-600">Saved — tracking on your Applications page.</p>
          {score >= GOOD_CHANCE_THRESHOLD && (
            <TailoredResumePreview applicationId={applicationId} />
          )}
        </div>
      )}
    </div>
  );
}
