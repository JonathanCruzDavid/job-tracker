"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function ResumeUpload({
  hasMaster,
  asMaster = true,
}: {
  hasMaster: boolean;
  asMaster?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a PDF or DOCX file.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("asMaster", String(asMaster));

    const res = await fetch("/api/resumes", { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));

    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      setError(body?.error ?? "Could not upload resume.");
      return;
    }

    if (body.warning) {
      setError(body.warning);
    } else {
      setSuccess(
        asMaster ? `Uploaded "${file.name}" — now your master resume.` : `Uploaded "${file.name}".`,
      );
    }

    router.refresh();
  }

  const label = !asMaster
    ? "Add another resume version (PDF or DOCX)"
    : hasMaster
      ? "Replace master resume (PDF or DOCX)"
      : "Upload master resume (PDF or DOCX)";

  return (
    <div>
      <label className="inline-block cursor-pointer rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/20">
        {uploading ? "Uploading..." : label}
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {asMaster && hasMaster && !error && !success && (
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          Uploading a new file replaces your current master resume.
        </p>
      )}
      {success && <p className="mt-1 text-sm text-green-600">{success}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
