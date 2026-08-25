"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotesEditor({
  applicationId,
  initialNotes,
}: {
  applicationId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch(`/api/applications/${applicationId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="Notes — interview prep, contacts, follow-ups..."
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
      >
        {saved ? "Saved" : saving ? "Saving..." : "Save notes"}
      </button>
    </div>
  );
}
