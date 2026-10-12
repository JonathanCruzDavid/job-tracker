import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";

const ExtractionSchema = z.object({
  outcome: z
    .enum(["confirmation", "rejection", "interview_request", "offer", "not_relevant"])
    .describe(
      "confirmation = an automated 'thank you for applying'/'we received your application' " +
        "acknowledgment. rejection = the candidate was turned down / the company decided to pursue " +
        "other candidates / the position was filled. interview_request = an invitation to " +
        "interview or schedule a call about a specific application. offer = a job offer. " +
        "not_relevant = a newsletter, job alert/recommendation ('jobs you may like'), marketing, " +
        "or anything else that isn't a real update about a job the candidate personally applied to.",
    ),
  company: z
    .string()
    .nullable()
    .describe("The hiring company's name, if identifiable. Null if not confidently determinable."),
  title: z
    .string()
    .nullable()
    .describe(
      "The job title applied to, if identifiable anywhere in the subject or body. Many emails " +
        "(e.g. LinkedIn's 'your application was sent to X') never state the title anywhere — null " +
        "is expected and fine in that case, don't guess.",
    ),
});

export type EmailExtraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `You are scanning a job applicant's whole inbox for any email that is a real update
about a specific job application they personally submitted — not just the "thank you for applying"
kind, but also rejections, interview invitations, and offers. This is a whole-inbox scan, so it
must also catch updates for jobs the applicant's own tracker doesn't know about yet (e.g. they
applied on a site or by direct email, outside whatever they normally use to track applications).

For each email, given its subject, sender, date, a short snippet, and (when available) the email
body text, classify it as one of:
- confirmation: the automated "we received your application" acknowledgment ATS platforms
  (Greenhouse, Lever, Workday, iCIMS, etc.) and job boards (Indeed, LinkedIn) send immediately
  after a submission.
- rejection: the candidate was turned down, the company "decided to pursue other candidates," the
  position was filled, or similar — regardless of how political or softly worded the language is.
- interview_request: an invitation to interview, schedule a call, or move to the next step for a
  specific application.
- offer: an actual job offer.
- not_relevant: a job alert/recommendation ("jobs you may like," "new jobs matching your search"),
  a newsletter, marketing, or anything that isn't a real personal update on a submitted
  application.

Extract the hiring company name and the job title from whatever the text actually says — check the
body, not just the subject, since the title is often only mentioned there. Do not guess or invent
a company/title if the text doesn't clearly state one — leave it null rather than fabricating. It's
normal and expected for some emails to have no title anywhere (e.g. LinkedIn's "your application
was sent to X" never states the role) — company alone is still a real, useful signal in that case.`;

export async function extractApplicationFromEmail(params: {
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
}): Promise<EmailExtraction> {
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 512,
    output_config: {
      effort: "low",
      format: zodOutputFormat(ExtractionSchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `From: ${params.from}\nDate: ${params.date}\nSubject: ${params.subject}\nSnippet: ${params.snippet}\n\nBody:\n${params.body || "(not available)"}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic did not return a parseable extraction");
  }

  return response.parsed_output;
}
