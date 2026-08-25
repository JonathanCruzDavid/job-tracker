"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeDocumentData } from "@/lib/pdf/resumeTemplate";

const inputClass =
  "rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-black dark:border-white/20 dark:bg-zinc-800 dark:text-white";
const textareaClass = `${inputClass} w-full`;

function bulletsToText(bullets: string[]): string {
  return bullets.join("\n");
}

function textToBullets(text: string): string[] {
  return text
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function TailoredResumePreview({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<ResumeDocumentData | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [savedResumeId, setSavedResumeId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("resume.pdf");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);

  // Renders a PDF for the current draft and stores it as a visible link the
  // user clicks themselves — window.open() calls that happen after an
  // await (i.e. after this fetch resolves) get silently blocked by popup
  // blockers in most browsers, so an automatic new tab isn't reliable.
  async function renderPreview(resumeData: ResumeDocumentData) {
    const res = await fetch("/api/resumes/render-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: resumeData, applicationId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Could not render a PDF preview.");
      return;
    }

    setPreviewFileName(res.headers.get("X-File-Name") ?? "resume.pdf");
    const blob = await res.blob();
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSavedResumeId(null);

    const res = await fetch("/api/resumes/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId }),
    });
    const body = await res.json().catch(() => ({}));

    setGenerating(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not generate a tailored resume.");
      return;
    }

    const { changes_made, masterResumeId: masterId, ...resumeData } = body;
    const typedResume = resumeData as ResumeDocumentData;
    setResume(typedResume);
    setChanges(changes_made ?? []);
    setMasterResumeId(masterId);
    setChatMessages([]);

    await renderPreview(typedResume);
  }

  async function handlePreview() {
    if (!resume) return;
    setPreviewing(true);
    setError(null);
    await renderPreview(resume);
    setPreviewing(false);
  }

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message || !resume) return;

    setSendingChat(true);
    setError(null);
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setChatInput("");

    const res = await fetch("/api/resumes/tailor/discuss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, resume, history: chatMessages, message }),
    });
    const body = await res.json().catch(() => ({}));

    setSendingChat(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not get a response.");
      return;
    }

    setChatMessages([...nextMessages, { role: "assistant", content: body.reply }]);
  }

  async function handleApplyChanges() {
    if (!resume || chatMessages.length === 0) return;
    setApplyingChanges(true);
    setError(null);

    const feedback = chatMessages
      .map((m) => `${m.role === "user" ? "Candidate" : "You"}: ${m.content}`)
      .join("\n");

    const res = await fetch("/api/resumes/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, currentDraft: resume, feedback }),
    });
    const body = await res.json().catch(() => ({}));

    setApplyingChanges(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not apply the changes.");
      return;
    }

    const { changes_made, masterResumeId: masterId, ...resumeData } = body;
    const typedResume = resumeData as ResumeDocumentData;
    setResume(typedResume);
    setChanges(changes_made ?? []);
    setMasterResumeId(masterId);
    setChatMessages([]);

    await renderPreview(typedResume);
  }

  async function handleSave() {
    if (!resume || !masterResumeId) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/applications/${applicationId}/tailored-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, masterResumeId }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not save the tailored resume.");
      return;
    }

    setSavedResumeId(body.resumeId);
    router.refresh();
  }

  if (!resume) {
    return (
      <div className="rounded-md border border-black/10 p-4 dark:border-white/20">
        <p className="mb-3 font-medium">Tailored resume</p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate tailored resume"}
        </button>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          A PDF preview link appears below as soon as it&apos;s ready.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-black/10 p-4 dark:border-white/20">
      <p className="mb-1 font-medium">Tailored resume</p>
      <p className="mb-2 text-sm text-amber-600">
        Review before using — check that nothing here overstates your experience.
      </p>
      {previewUrl && (
        <a
          href={previewUrl}
          download={previewFileName}
          className="mb-4 inline-block rounded-md border border-black/10 bg-black/5 px-3 py-1.5 text-sm font-medium dark:border-white/20 dark:bg-white/10"
        >
          📄 Download PDF preview
        </a>
      )}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Name
            <input
              className={inputClass}
              value={resume.name}
              onChange={(e) => setResume({ ...resume, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Location
            <input
              className={inputClass}
              value={resume.location ?? ""}
              onChange={(e) => setResume({ ...resume, location: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Phone
            <input
              className={inputClass}
              value={resume.phone ?? ""}
              onChange={(e) => setResume({ ...resume, phone: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Email
            <input
              className={inputClass}
              value={resume.email ?? ""}
              onChange={(e) => setResume({ ...resume, email: e.target.value })}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Links (one per line)
          <textarea
            rows={2}
            className={textareaClass}
            value={resume.links.join("\n")}
            onChange={(e) => setResume({ ...resume, links: textToBullets(e.target.value) })}
          />
        </label>

        {resume.summary !== null && (
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Summary
            <textarea
              rows={3}
              className={textareaClass}
              value={resume.summary}
              onChange={(e) => setResume({ ...resume, summary: e.target.value })}
            />
          </label>
        )}

        {resume.education.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">Education</p>
            <div className="flex flex-col gap-3">
              {resume.education.map((edu, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    value={edu.degree}
                    placeholder="Degree"
                    onChange={(e) => {
                      const next = [...resume.education];
                      next[i] = { ...next[i], degree: e.target.value };
                      setResume({ ...resume, education: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    value={edu.dates ?? ""}
                    placeholder="Dates"
                    onChange={(e) => {
                      const next = [...resume.education];
                      next[i] = { ...next[i], dates: e.target.value };
                      setResume({ ...resume, education: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    value={edu.school}
                    placeholder="School"
                    onChange={(e) => {
                      const next = [...resume.education];
                      next[i] = { ...next[i], school: e.target.value };
                      setResume({ ...resume, education: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    value={edu.location ?? ""}
                    placeholder="Location"
                    onChange={(e) => {
                      const next = [...resume.education];
                      next[i] = { ...next[i], location: e.target.value };
                      setResume({ ...resume, education: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.experience.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">
              Work experience
            </p>
            <div className="flex flex-col gap-3">
              {resume.experience.map((job, i) => (
                <div
                  key={i}
                  className="rounded-md border border-black/5 p-3 dark:border-white/10"
                >
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      className={inputClass}
                      value={job.title}
                      placeholder="Title"
                      onChange={(e) => {
                        const next = [...resume.experience];
                        next[i] = { ...next[i], title: e.target.value };
                        setResume({ ...resume, experience: next });
                      }}
                    />
                    <input
                      className={inputClass}
                      value={job.location ?? ""}
                      placeholder="Location"
                      onChange={(e) => {
                        const next = [...resume.experience];
                        next[i] = { ...next[i], location: e.target.value };
                        setResume({ ...resume, experience: next });
                      }}
                    />
                    <input
                      className={inputClass}
                      value={job.company}
                      placeholder="Company"
                      onChange={(e) => {
                        const next = [...resume.experience];
                        next[i] = { ...next[i], company: e.target.value };
                        setResume({ ...resume, experience: next });
                      }}
                    />
                    <input
                      className={inputClass}
                      value={job.dates ?? ""}
                      placeholder="Dates"
                      onChange={(e) => {
                        const next = [...resume.experience];
                        next[i] = { ...next[i], dates: e.target.value };
                        setResume({ ...resume, experience: next });
                      }}
                    />
                  </div>
                  <textarea
                    rows={Math.max(3, job.bullets.length)}
                    className={textareaClass}
                    value={bulletsToText(job.bullets)}
                    placeholder="One bullet per line"
                    onChange={(e) => {
                      const next = [...resume.experience];
                      next[i] = { ...next[i], bullets: textToBullets(e.target.value) };
                      setResume({ ...resume, experience: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.projects.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">Projects</p>
            <div className="flex flex-col gap-3">
              {resume.projects.map((project, i) => (
                <div
                  key={i}
                  className="rounded-md border border-black/5 p-3 dark:border-white/10"
                >
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      className={inputClass}
                      value={project.name}
                      placeholder="Project name"
                      onChange={(e) => {
                        const next = [...resume.projects];
                        next[i] = { ...next[i], name: e.target.value };
                        setResume({ ...resume, projects: next });
                      }}
                    />
                    <input
                      className={inputClass}
                      value={project.stack ?? ""}
                      placeholder="Stack"
                      onChange={(e) => {
                        const next = [...resume.projects];
                        next[i] = { ...next[i], stack: e.target.value };
                        setResume({ ...resume, projects: next });
                      }}
                    />
                    <input
                      className={`${inputClass} sm:col-span-2`}
                      value={project.subtitle ?? ""}
                      placeholder="Subtitle"
                      onChange={(e) => {
                        const next = [...resume.projects];
                        next[i] = { ...next[i], subtitle: e.target.value };
                        setResume({ ...resume, projects: next });
                      }}
                    />
                  </div>
                  <textarea
                    rows={Math.max(3, project.bullets.length)}
                    className={textareaClass}
                    value={bulletsToText(project.bullets)}
                    placeholder="One bullet per line"
                    onChange={(e) => {
                      const next = [...resume.projects];
                      next[i] = { ...next[i], bullets: textToBullets(e.target.value) };
                      setResume({ ...resume, projects: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.skills.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">
              Technical skills
            </p>
            <div className="flex flex-col gap-2">
              {resume.skills.map((group, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
                  <input
                    className={inputClass}
                    value={group.category}
                    placeholder="Category"
                    onChange={(e) => {
                      const next = [...resume.skills];
                      next[i] = { ...next[i], category: e.target.value };
                      setResume({ ...resume, skills: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    value={group.items.join(", ")}
                    placeholder="Comma-separated items"
                    onChange={(e) => {
                      const next = [...resume.skills];
                      next[i] = {
                        ...next[i],
                        items: e.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      };
                      setResume({ ...resume, skills: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {changes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-black/50 dark:text-white/50">What changed</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-md border border-black/10 p-3 dark:border-white/20">
          <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">
            Talk through what you like or don&apos;t like
          </p>
          {chatMessages.length > 0 && (
            <div className="mb-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-md px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "self-end bg-foreground text-background"
                      : "self-start bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={`${inputClass} flex-1`}
              placeholder="e.g. I don't like that the Riffstub project is first..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !sendingChat) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              disabled={sendingChat}
            />
            <button
              onClick={handleSendChat}
              disabled={sendingChat || !chatInput.trim()}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/20 disabled:opacity-50"
            >
              {sendingChat ? "..." : "Send"}
            </button>
          </div>
          {chatMessages.length > 0 && (
            <button
              onClick={handleApplyChanges}
              disabled={applyingChanges}
              className="mt-2 rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
            >
              {applyingChanges ? "Applying..." : "Apply these changes"}
            </button>
          )}
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            Nothing changes until you click &quot;Apply these changes&quot; — discussing it first
            is just talk.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
          >
            {previewing ? "Opening..." : "Preview PDF"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || Boolean(savedResumeId)}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
          >
            {savedResumeId ? "Saved" : saving ? "Saving..." : "Confirm and save as PDF"}
          </button>
          {savedResumeId && (
            <a
              href={`/api/resumes/${savedResumeId}/file`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
