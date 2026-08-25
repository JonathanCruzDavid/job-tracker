"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TailoredResumePreview from "@/components/TailoredResumePreview";
import ImportBookmarklet from "@/components/ImportBookmarklet";
import PendingBookmarks, { type PendingBookmark } from "@/components/PendingBookmarks";

const GOOD_CHANCE_THRESHOLD = 65;
const SOURCE_SITES = ["LinkedIn", "Indeed", "Company website", "Other"];

type ImportResult = {
  matchId: string;
  score: number;
  matchingSkills: string[];
  gaps: string[];
  improvementTips: string[];
  summary: string | null;
};

function ImportJobForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSourceSite = searchParams.get("sourceSite") ?? "";
  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [company, setCompany] = useState(searchParams.get("company") ?? "");
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [sourceSite, setSourceSite] = useState(
    SOURCE_SITES.includes(initialSourceSite) ? initialSourceSite : "",
  );
  const [description, setDescription] = useState(searchParams.get("description") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setApplicationId(null);

    const res = await fetch("/api/jobs/manual-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, company, url, sourceSite: sourceSite || null, description }),
    });
    const body = await res.json().catch(() => ({}));

    setLoading(false);

    if (!res.ok) {
      setError(body?.error ?? "Something went wrong.");
      return;
    }

    setResult({
      matchId: body.matchId,
      score: body.score,
      matchingSkills: body.matchingSkills ?? [],
      gaps: body.gaps ?? [],
      improvementTips: body.improvementTips ?? [],
      summary: body.summary ?? null,
    });
    router.refresh();
  }

  async function handleSaveAndTrack() {
    if (!result) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/matches/${result.matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save" }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not save this application.");
      return;
    }

    setApplicationId(body.applicationId);
    router.refresh();
  }

  function handleUseBookmark(bookmark: PendingBookmark) {
    setTitle(bookmark.guessedTitle);
    setCompany(bookmark.guessedCompany ?? "");
    setUrl(bookmark.url);
    setSourceSite(SOURCE_SITES.includes(bookmark.guessedSourceSite) ? bookmark.guessedSourceSite : "");
    setResult(null);
    setApplicationId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Import a job</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        Paste in a posting you found yourself — LinkedIn, Indeed, or anywhere else. We&apos;ll
        score it against your master resume right away.
      </p>

      <PendingBookmarks onUse={handleUseBookmark} />
      <ImportBookmarklet />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Job title
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Company
          <input
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Where did you find this?
          <select
            value={sourceSite}
            onChange={(e) => setSourceSite(e.target.value)}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-black dark:border-white/20 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Not specified</option>
            {SOURCE_SITES.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Posting URL (optional, for your own reference)
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Job description
          <textarea
            required
            rows={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 self-start rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {loading ? "Scoring..." : "Score this job"}
        </button>
      </form>

      {result && (
        <div className="mt-8 rounded-md border border-black/10 p-4 dark:border-white/20">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Your fit score</p>
            <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-medium dark:bg-white/10">
              {result.score}/100
            </span>
          </div>
          {result.summary && (
            <p className="mb-3 text-sm text-black/70 dark:text-white/70">{result.summary}</p>
          )}
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {result.matchingSkills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-black/50 dark:text-white/50">Matching</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {result.matchingSkills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.gaps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-black/50 dark:text-white/50">Gaps</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {result.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {result.improvementTips.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-black/50 dark:text-white/50">
                How to improve your chances
              </p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {result.improvementTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {!applicationId ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveAndTrack}
                disabled={saving}
                className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
              >
                {saving ? "Saving..." : "Track this application"}
              </button>
              <a href="/matches" className="text-sm underline">
                Or review it later on Matches
              </a>
            </div>
          ) : (
            <div className="border-t border-black/10 pt-3 dark:border-white/20">
              <p className="mb-2 text-sm text-green-600">Saved — tracking on your Applications page.</p>
              {result.score >= GOOD_CHANCE_THRESHOLD && (
                <TailoredResumePreview applicationId={applicationId} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportJobPage() {
  return (
    <Suspense>
      <ImportJobForm />
    </Suspense>
  );
}
