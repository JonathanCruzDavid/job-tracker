import { getGmailClient } from "./client";

export type ApplicationCandidateEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
};

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

// Subjects/snippets alone often don't mention the job title (LinkedIn's
// "your application was sent to X" never does) — the actual body usually
// does. Walks the MIME tree for the first text/plain part, falling back to
// stripping tags out of text/html.
function extractBodyText(payload: GmailPart | undefined, depth = 0): string {
  if (!payload || depth > 5) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBodyText(part, depth + 1);
      if (text) return text;
    }
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

// Broad, whole-inbox search for any job-application-lifecycle email —
// confirmations, rejections, interview requests, offers — unlike
// searchRepliesForCompany, this isn't scoped to companies already tracked,
// since the whole point is catching activity the tracker doesn't know about
// yet (e.g. applied on a site the extension never captured, or a rejection
// for a job that was never logged at all). Real-world wording varies a lot
// company to company ("Thanks for your application", "we've decided to
// pursue other candidates", "Update on your application", "Let's schedule a
// time to talk") — unquoted keywords catch far more of that than a fixed
// list of exact phrases would — combined with known ATS/job-board sender
// domains as a second, independent path to a match.
const APPLICATION_EMAIL_QUERY = [
  'subject:(application OR applying OR applied OR interview OR candidacy OR "your interest" OR "hiring process")',
  "from:indeedapply@indeed.com",
  "from:jobs-noreply@linkedin.com",
  "from:greenhouse.io",
  "from:lever.co",
  "from:myworkdayjobs.com",
  "from:icims.com",
  "from:smartrecruiters.com",
  "from:ashbyhq.com",
  "from:workable.com",
].join(" OR ");

export async function searchApplicationEmails(
  daysBack = 90,
  maxResults = 50,
): Promise<ApplicationCandidateEmail[]> {
  const gmail = getGmailClient();
  const query = `(${APPLICATION_EMAIL_QUERY}) newer_than:${daysBack}d`;

  const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  const messages = list.data.messages ?? [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map((m) => gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" })),
  );

  return details.map((res) => ({
    id: res.data.id ?? "",
    subject: header(res.data.payload?.headers, "Subject"),
    from: header(res.data.payload?.headers, "From"),
    date: header(res.data.payload?.headers, "Date"),
    snippet: res.data.snippet ?? "",
    body: extractBodyText(res.data.payload ?? undefined).slice(0, 3000),
  }));
}
