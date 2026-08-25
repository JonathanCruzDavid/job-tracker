"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export default function StatusDropdown({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === status) return;

    setUpdating(true);

    await fetch(`/api/applications/${applicationId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    setUpdating(false);
    router.refresh();
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={updating}
      className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-black dark:border-white/20 dark:bg-zinc-800 dark:text-white"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
