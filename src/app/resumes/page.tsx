import { db } from "@/lib/db";
import ResumeUpload from "@/components/ResumeUpload";
import SetMasterResumeButton from "@/components/SetMasterResumeButton";

export const dynamic = "force-dynamic";

type ResumeRow = {
  id: string;
  is_master: number;
  based_on_resume_id: string | null;
  file_name: string;
  storage_path: string | null;
  mime_type: string;
  extracted_text: string | null;
  created_at: string;
};

export default async function ResumesPage() {
  const resumes = db
    .prepare(
      "select id, is_master, based_on_resume_id, file_name, storage_path, mime_type, extracted_text, created_at from resumes order by created_at desc",
    )
    .all() as ResumeRow[];

  const master = resumes.find((r) => r.is_master);
  // Any manually-uploaded version that isn't the master and wasn't
  // AI-generated for a specific application — e.g. a Software Engineer or
  // Data Analyst variant you want on hand and downloadable, without it being
  // the one used for job scoring.
  const otherVersions = resumes.filter((r) => !r.is_master && !r.based_on_resume_id);
  // AI-tailored copies always have based_on_resume_id set.
  const tailored = resumes.filter((r) => !r.is_master && r.based_on_resume_id);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Resumes</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
          Master resume
        </h2>
        {master ? (
          <div className="rounded-md border border-black/10 p-4 dark:border-white/20">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{master.file_name}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  Uploaded {new Date(master.created_at).toLocaleString()}
                </p>
              </div>
              {master.storage_path && (
                <a
                  href={`/api/resumes/${master.id}/file`}
                  className="flex-shrink-0 rounded-md border border-black/10 px-3 py-1.5 text-xs dark:border-white/20"
                >
                  Download
                </a>
              )}
            </div>

            {master.storage_path ? (
              master.mime_type === "application/pdf" ? (
                <iframe
                  src={`/api/resumes/${master.id}/file?disposition=inline`}
                  className="h-[700px] w-full rounded-md border border-black/10 dark:border-white/20"
                  title="Master resume preview"
                />
              ) : (
                <p className="text-sm text-black/60 dark:text-white/60">
                  This is a .docx file, which browsers can&apos;t preview inline — use Download
                  above to see it.
                </p>
              )
            ) : master.extracted_text ? (
              <p className="whitespace-pre-line text-sm text-black/60 dark:text-white/60">
                {master.extracted_text.slice(0, 400)}
                {master.extracted_text.length > 400 ? "…" : ""}
              </p>
            ) : (
              <p className="text-sm text-amber-600">
                Uploaded, but no text could be extracted yet.
              </p>
            )}
          </div>
        ) : (
          <p className="mb-3 text-sm text-black/60 dark:text-white/60">
            Upload your resume so jobs can be scored against it.
          </p>
        )}
        <div className="mt-3">
          <ResumeUpload hasMaster={Boolean(master)} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
          Other versions
        </h2>
        {otherVersions.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {otherVersions.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
              >
                <div>
                  <p>{r.file_name}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {r.storage_path && r.mime_type === "application/pdf" && (
                    <a
                      href={`/api/resumes/${r.id}/file?disposition=inline`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-black/10 px-3 py-1.5 text-xs dark:border-white/20"
                    >
                      View
                    </a>
                  )}
                  {r.storage_path && (
                    <a
                      href={`/api/resumes/${r.id}/file`}
                      className="rounded-md border border-black/10 px-3 py-1.5 text-xs dark:border-white/20"
                    >
                      Download
                    </a>
                  )}
                  <SetMasterResumeButton resumeId={r.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <ResumeUpload hasMaster={Boolean(master)} asMaster={false} />
      </section>

      {tailored.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
            Tailored copies
          </h2>
          <ul className="flex flex-col gap-2">
            {tailored.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
              >
                <div>
                  <p>{r.file_name}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                {r.storage_path && (
                  <div className="flex flex-shrink-0 gap-2">
                    {r.mime_type === "application/pdf" && (
                      <a
                        href={`/api/resumes/${r.id}/file?disposition=inline`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-black/10 px-3 py-1.5 text-xs dark:border-white/20"
                      >
                        View
                      </a>
                    )}
                    <a
                      href={`/api/resumes/${r.id}/file`}
                      className="rounded-md border border-black/10 px-3 py-1.5 text-xs dark:border-white/20"
                    >
                      Download
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
