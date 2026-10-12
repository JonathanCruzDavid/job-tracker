import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";

const ClassificationSchema = z.object({
  match_confidence: z
    .enum(["none", "low", "medium", "high"])
    .describe("How likely this email is actually about the specific application given, not just a general email that happens to mention the company"),
  signal: z
    .enum(["rejection", "interview_request", "offer", "ack_only", "unclear", "not_related"])
    .describe(
      "What kind of update this is. ack_only = automated 'we received your application'. not_related = doesn't seem to be about this application at all (e.g. a newsletter, a different unrelated email from the same company).",
    ),
  summary: z.string().describe("One plain-English sentence explaining the verdict"),
});

export type EmailClassification = z.infer<typeof ClassificationSchema>;

const SYSTEM = `You are helping a job applicant figure out whether an email in their inbox is an
update about a SPECIFIC job application they made, and if so what kind of update it is.

You are given the application (company, role, roughly when they applied) and one email's
metadata (subject, sender, date, snippet — not necessarily the full body). Decide:
- match_confidence: how likely this specific email is actually about THIS application, not just
  any email that happens to mention the company name (a newsletter, an unrelated marketing email,
  a different job at the same company, etc. should get low or none).
- signal: what kind of update it is, if any.

Be conservative — a generic "thank you for applying" auto-reply is ack_only, not a real update.
If the snippet is too short/generic to tell, say match_confidence "low" or "medium" and signal
"unclear" rather than guessing confidently in either direction.`;

export async function classifyEmailReply(params: {
  company: string;
  title: string;
  appliedAt: string | null;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}): Promise<EmailClassification> {
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 512,
    output_config: {
      effort: "low",
      format: zodOutputFormat(ClassificationSchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `APPLICATION:\nCompany: ${params.company}\nRole: ${params.title}\nApplied: ${params.appliedAt ?? "unknown date"}\n\nEMAIL:\nFrom: ${params.from}\nDate: ${params.date}\nSubject: ${params.subject}\nSnippet: ${params.snippet}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic did not return a parseable classification");
  }

  return response.parsed_output;
}
