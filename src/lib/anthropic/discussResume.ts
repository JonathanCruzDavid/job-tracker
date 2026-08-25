import { anthropic } from "./client";

export type ChatMessage = { role: "user" | "assistant"; content: string };

function buildSystem(params: {
  resumeText: string;
  title: string;
  company: string;
  description: string;
}): string {
  return `You are discussing a tailored resume draft with a candidate before any changes are
applied to it. Talk with them about what they like or don't like — do NOT rewrite the resume in
your replies, only discuss it. A separate step applies changes once they've said what they want.

CURRENT DRAFT:
${params.resumeText}

JOB POSTING:
Title: ${params.title}
Company: ${params.company}
Description: ${params.description}

Respond conversationally and concisely (2-4 sentences, unless more detail is clearly needed). If
they raise something you could improve, describe SPECIFICALLY what you would change (e.g. "I'd
move the Python bullet to the top of that role and shorten the summary to two sentences") so they
know what they're agreeing to before they confirm. If their feedback is vague, ask a clarifying
question instead of guessing. Never propose adding anything not already present in the draft
above — only reordering, rephrasing, or emphasis changes.`;
}

export async function discussResume(params: {
  resumeText: string;
  title: string;
  company: string;
  description: string;
  history: ChatMessage[];
  message: string;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    output_config: { effort: "medium" },
    system: buildSystem(params),
    messages: [...params.history, { role: "user", content: params.message }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
