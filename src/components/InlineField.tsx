"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InlineField({
  applicationId,
  endpoint,
  bodyKey,
  initialValue,
  placeholder,
}: {
  applicationId: string;
  endpoint: "notes" | "interview-stage";
  bodyKey: "notes" | "interviewStage";
  initialValue: string | null;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (value === (initialValue ?? "")) return;
    setSaving(true);

    await fetch(`/api/applications/${applicationId}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [bodyKey]: value }),
    });

    setSaving(false);
    router.refresh();
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={saving}
      className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-black/10 focus:border-black/20 focus:outline-none disabled:opacity-50 dark:hover:border-white/20 dark:focus:border-white/30"
    />
  );
}
