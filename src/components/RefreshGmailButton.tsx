"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshGmailButton() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setChecking(true);
    setError(null);

    const res = await fetch("/api/gmail/sync", { method: "POST" });
    const body = await res.json().catch(() => ({}));

    setChecking(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not check Gmail.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={checking}
        className="rounded-md border border-black/10 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/20"
      >
        {checking ? "Checking..." : "Refresh now"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
