"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetMasterResumeButton({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await fetch(`/api/resumes/${resumeId}/set-master`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="rounded-md border border-black/10 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/20"
    >
      {busy ? "Setting..." : "Set as master"}
    </button>
  );
}
