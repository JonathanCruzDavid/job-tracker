import { db } from "@/lib/db";
import ResumeUpload from "@/components/ResumeUpload";

export const dynamic = "force-dynamic";

type ResumeRow = {
  id: string;
  is_master: number;
  based_on_resume_id: string | null;
  file_name: string;
  extracted_text: string | null;
  created_at: string;
};

export default async function ResumesPage() {
  const resumes = db
    .prepare(
      "select id, is_master, based_on_resume_id, file_name, extracted_text, created_at from resumes order by created_at desc",
    )
    .all() as ResumeRow[];

  const master = resumes.find((r) => r.is_master);
  // Distinguish AI-tailored copies (always have based_on_resume_id set)
  // from old, superseded master uploads (is_master = 0 too, but were never
  // generated from anything) — the latter just aren't shown.
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
            <p className="mb-2 font-medium">{master.file_name}</p>
            <p className="mb-2 text-xs text-black/50 dark:text-white/50">
              Uploaded {new Date(master.created_at).toLocaleString()}
            </p>
            {master.extracted_text ? (
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

      {tailored.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
            Tailored copies
          </h2>
          <ul className="flex flex-col gap-2">
            {tailored.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-black/10 p-3 text-sm dark:border-white/20"
              >
                {r.file_name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
