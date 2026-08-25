import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";

const ResumeDocumentSchema = z.object({
  name: z.string(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  links: z.array(z.string()).describe("e.g. LinkedIn URL, personal site — as they appear on the original resume"),
  summary: z.string().nullable(),
  section_order: z
    .array(z.enum(["summary", "education", "experience", "projects", "skills"]))
    .describe(
      "The order sections should appear in on the page. Default to summary, education, experience, projects, skills (the standard order) unless the candidate has specifically asked for a different order.",
    ),
  education: z.array(
    z.object({
      degree: z.string(),
      school: z.string(),
      location: z.string().nullable(),
      dates: z.string().nullable(),
    }),
  ),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      dates: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      stack: z.string().nullable().describe("e.g. \"Next.js | TypeScript | React\""),
      subtitle: z.string().nullable(),
      dates: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(
    z.object({
      category: z.string().describe("e.g. \"Programming Languages\""),
      items: z.array(z.string()),
    }),
  ),
  changes_made: z
    .array(z.string())
    .describe("Bullet list of what was reordered/rephrased/emphasized, for the user to review"),
});

export type TailoredResumeResult = z.infer<typeof ResumeDocumentSchema>;

const SYSTEM = `You are helping a job applicant tailor their resume to a specific job posting.

The user's original resume is unstructured text below. First, faithfully extract its existing
content into the structured format — the same sections, the same entries, the same facts. Then
apply tailoring on top of that faithful extraction:
- Reorder bullet points and skills within a section to foreground experience most relevant to
  this job. Use section_order for the standard order (summary, education, experience, projects,
  skills) unless the posting clearly calls for a different section to be more prominent.
- Rephrase existing bullet points using terminology from the job posting, where that terminology
  accurately describes what the resume already says.
- Adjust emphasis (what's listed first, how much detail) to match what this posting values.

You must NOT, under any circumstances:
- Invent, imply, or add any job title, employer, credential, certification, skill, tool, metric,
  or accomplishment that is not already present in the original resume text below.
- Add, remove, split, or merge education/experience/project entries — every entry in the
  original must appear exactly once in your output, and you must not add new ones.
- Change dates, job titles, company names, degrees, or any other factual claim.
- Round up or exaggerate proficiency (e.g. turning "used SQL a few times" into "SQL expert").

If the job posting requires a skill or qualification that is genuinely absent from the original
resume, simply do not emphasize it — do not add it. It is acceptable and expected for the
tailored resume to still show gaps relative to the posting. Every fact in your output must be
traceable to the original resume text provided by the user. Leave a field null/empty if the
original resume doesn't have that information — do not fabricate a value to fill it in.`;

export async function tailorResume(params: {
  resumeText: string;
  title: string;
  company: string;
  description: string;
}): Promise<TailoredResumeResult> {
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    output_config: {
      effort: "high",
      format: zodOutputFormat(ResumeDocumentSchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `ORIGINAL RESUME:\n${params.resumeText}\n\nJOB POSTING:\nTitle: ${params.title}\nCompany: ${params.company}\nDescription: ${params.description}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic did not return a parseable tailored resume");
  }

  return response.parsed_output;
}

const REVISE_SYSTEM = `You are updating a tailored resume draft based on feedback the candidate
gave you in conversation, before they've confirmed and saved it.

You'll be given the candidate's ORIGINAL resume (the ground truth for what's actually true about
them), the CURRENT DRAFT they've been reviewing, and their feedback. Produce an updated version
of the draft that addresses the feedback.

The same rules as tailoring apply, without exception, even when applying feedback:
- Never invent, imply, or add any job title, employer, credential, certification, skill, tool,
  metric, or accomplishment that is not already present in the ORIGINAL resume.
- Never add, remove, split, or merge education/experience/project entries relative to the
  ORIGINAL resume — every entry in the original must still appear exactly once.
- Never change dates, job titles, company names, degrees, or any other factual claim.
- If the candidate's feedback asks for something that isn't grounded in the original resume
  (e.g. "make it sound like I know Kubernetes" when nothing in the original resume mentions it),
  do not comply — keep that part as it was and note in changes_made that you couldn't make that
  specific change without fabricating something.

If the feedback asks to reorder sections (e.g. "put Projects above Work Experience"), reflect
that by changing section_order — that field, not the order of keys in your JSON output, controls
what order sections render in.`;

export async function reviseResume(params: {
  originalResumeText: string;
  currentDraft: Omit<TailoredResumeResult, "changes_made">;
  title: string;
  company: string;
  description: string;
  feedback: string;
}): Promise<TailoredResumeResult> {
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    output_config: {
      effort: "high",
      format: zodOutputFormat(ResumeDocumentSchema),
    },
    system: REVISE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `ORIGINAL RESUME:\n${params.originalResumeText}\n\nCURRENT DRAFT (JSON):\n${JSON.stringify(params.currentDraft, null, 2)}\n\nJOB POSTING:\nTitle: ${params.title}\nCompany: ${params.company}\nDescription: ${params.description}\n\nCANDIDATE FEEDBACK ON THE CURRENT DRAFT:\n${params.feedback}\n\nProduce an updated draft addressing this feedback.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic did not return a parseable revised resume");
  }

  return response.parsed_output;
}
