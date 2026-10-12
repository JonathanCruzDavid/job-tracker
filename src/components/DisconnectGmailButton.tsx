"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisconnectGmailButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDisconnect() {
    if (!confirm("Disconnect Gmail? You'll need to reconnect to check for replies again.")) return;

    setBusy(true);
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={busy}
      className="text-sm text-red-600 underline disabled:opacity-50 dark:text-red-400"
    >
      {busy ? "Disconnecting..." : "Disconnect"}
    </button>
  );
}
