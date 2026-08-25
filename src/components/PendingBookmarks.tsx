"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 30_000;
const SOURCE_SITES = ["LinkedIn", "Indeed", "Company website", "Other"];

export type PendingBookmark = {
  url: string;
  rawTitle: string;
  guessedTitle: string;
  guessedCompany: string | null;
  guessedSourceSite: string;
};

export default function PendingBookmarks({
  onUse,
}: {
  onUse: (bookmark: PendingBookmark) => void;
}) {
  const [pending, setPending] = useState<PendingBookmark[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const res = await fetch("/api/bookmarks/pending");
    if (!res.ok) return;
    const body = await res.json().catch(() => ({}));
    setPending(body.pending ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    const initial = setTimeout(refresh, 0);
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  async function handleDismiss(url: string) {
    setPending((prev) => prev.filter((b) => b.url !== url));
    await fetch("/api/bookmarks/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  }

  if (!loaded || pending.length === 0) return null;

  return (
    <div className="mb-8 rounded-md border border-black/10 p-4 dark:border-white/20">
      <p className="mb-1 font-medium">
        {pending.length} new from your &quot;Jobapps&quot; bookmarks
      </p>
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        Title/company are guessed from the bookmark name — check them before scoring. Checks
        automatically every 30 seconds while this page is open.
      </p>
      <ul className="flex flex-col gap-2">
        {pending.map((bookmark) => (
          <li
            key={bookmark.url}
            className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{bookmark.guessedTitle}</p>
              <p className="truncate text-black/60 dark:text-white/60">
                {bookmark.guessedCompany ?? "Unknown company"}
                {SOURCE_SITES.includes(bookmark.guessedSourceSite)
                  ? ` · ${bookmark.guessedSourceSite}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap text-xs underline"
              >
                Open
              </a>
              <button
                onClick={() => onUse(bookmark)}
                className="whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background"
              >
                Use this
              </button>
              <button
                onClick={() => handleDismiss(bookmark.url)}
                className="whitespace-nowrap rounded-md border border-black/10 px-2.5 py-1 text-xs dark:border-white/20"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
