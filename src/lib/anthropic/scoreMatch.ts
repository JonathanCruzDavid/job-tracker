import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";

const JobMatchSchema = z.object({
  score: z.number().int().min(0).max(100).describe("Overall fit score, 0-100"),
  matching_skills: z
    .array(z.string())
    .describe("Requirements from the posting explicitly evidenced in the resume"),
  gaps: z
    .array(z.string())
    .describe("Requirements from the posting not evidenced in the resume"),
  improvement_tips: z
    .array(z.string())
    .describe(
      "Concrete, actionable suggestions for how the candidate could present themselves better for THIS posting — e.g. what existing experience to emphasize or reorder, not new skills to go acquire. Empty array if there's nothing meaningful to suggest.",
    ),
  summary: z
    .string()
    .describe("2-3 sentence plain-English explanation of the score, written for the candidate"),
});

export type JobMatchResult = z.infer<typeof JobMatchSchema>;

const SYSTEM = `You evaluate how well a candidate's resume matches a job posting.

Score conservatively: only list a skill as "matching" if it is explicitly present or very
strongly implied in the resume text. List requirements from the posting that are not
evidenced in the resume as "gaps" — do not guess or assume the candidate secretly has them.
Do not fabricate, infer beyond reasonable evidence, or embellish the candidate's background.

For improvement_tips, suggest how the candidate could better PRESENT experience they already
have for this specific posting (what to emphasize, reorder, or phrase differently) — not
skills to go learn or credentials to acquire. If the resume is already well-aligned, return
an empty array rather than inventing filler advice.`;

export async function scoreMatch(params: {
  resumeText: string;
  title: string;
  company: string;
  description: string;
}): Promise<JobMatchResult> {
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: zodOutputFormat(JobMatchSchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `RESUME:\n${params.resumeText}\n\nJOB POSTING:\nTitle: ${params.title}\nCompany: ${params.company}\nDescription: ${params.description}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic did not return a parseable match result");
  }

  return response.parsed_output;
}
