"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteApplicationButton({
  applicationId,
  redirectTo,
  label = "Delete",
  className,
}: {
  applicationId: string;
  redirectTo?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this application? This can't be undone.")) return;

    setBusy(true);
    const res = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      alert("Could not delete this application.");
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className={className ?? "text-sm text-red-600 underline disabled:opacity-50 dark:text-red-400"}
    >
      {busy ? "Deleting..." : label}
    </button>
  );
}
