import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";

const LegitimacySchema = z.object({
  verdict: z
    .enum(["likely_legit", "uncertain", "likely_scam"])
    .describe("Overall read on the posting based on text patterns alone"),
  risk_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0 = no concerning signals, 100 = matches classic job-scam patterns closely"),
  red_flags: z
    .array(z.string())
    .describe(
      "Specific concrete signals found in THIS posting (e.g. 'asks to buy your own equipment and get reimbursed', 'contact moves to WhatsApp/Telegram', 'pay is far above market for the stated skill level'). Empty array if nothing concrete was found.",
    ),
  reasoning: z
    .string()
    .describe("1-3 sentence plain-English explanation of the verdict, written for the candidate"),
});

export type LegitimacyResult = z.infer<typeof LegitimacySchema>;

const SYSTEM = `You screen job postings for common employment-scam patterns, using only the text
provided (title, company, description, URL/source). You have no way to verify facts about the
company beyond this text — you are pattern-matching against known scam tactics, not confirming
whether the company is real.

Classic red flags to look for:
- Any request for money, a "starter kit" purchase, check-cashing, or buying your own equipment
  with a promise of reimbursement.
- Requests for sensitive personal/financial info (bank account, SSN, ID scans) before any real
  interview process.
- Communication that pushes toward a personal messaging app (WhatsApp, Telegram, Signal) or a
  free personal email domain instead of a company channel.
- Unusually high pay for vague, minimal-skill, or minimal-experience work ("$40+/hr, no
  experience needed, work 2 hours a day").
- Interviews that are unusually shallow (a single text-chat "interview," instant job offers with
  no real screening) for the seniority/pay implied.
- Extremely generic or vague company description with no verifiable specifics about what the
  company actually does.
- Urgency/pressure language ("act now," "limited spots," pushing to accept within hours).
- A well-known company name paired with a URL/domain or contact email that doesn't plausibly
  belong to that company (impersonation).

Do NOT flag a posting just for being terse, from a small/unfamiliar company, or offering
remote work — those alone are normal and not evidence of a scam. Only flag concrete patterns
actually present in the text. Score conservatively: most real job postings should come back
"likely_legit" with a low risk_score and an empty red_flags array. Reserve "likely_scam" for
postings matching multiple classic patterns clearly, and "uncertain" for postings with one
ambiguous signal worth a second look but not enough to call it a scam outright.`;

export async function checkJobLegitimacy(params: {
  title: string;
  company: string;
  description: string;
  url: string | null;
  sourceSite: string | null;
}): Promise<LegitimacyResult> {
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 768,
    output_config: {
      effort: "low",
      format: zodOutputFormat(LegitimacySchema),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Title: ${params.title}\nCompany: ${params.company}\nSource: ${params.sourceSite ?? "unknown"}\nURL: ${params.url ?? "none provided"}\n\nDescription:\n${params.description}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic did not return a parseable legitimacy result");
  }

  return response.parsed_output;
}
