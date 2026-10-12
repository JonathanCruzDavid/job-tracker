import { getGmailClient } from "./client";

export type CandidateEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
};

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function gmailDateQuery(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return ` after:${y}/${m}/${day}`;
}

// Narrow, per-application search rather than a blanket inbox scan — keeps
// noise down and keeps the later classification pass cheap. Quoting the
// company name searches it as a phrase across subject/body/sender.
export async function searchRepliesForCompany(
  company: string,
  appliedAtIso: string | null,
  maxResults = 5,
): Promise<CandidateEmail[]> {
  const gmail = getGmailClient();
  const safeCompany = company.replace(/"/g, "");
  const query = `"${safeCompany}"${gmailDateQuery(appliedAtIso)}`;

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = list.data.messages ?? [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      }),
    ),
  );

  return details.map((res) => ({
    id: res.data.id ?? "",
    subject: header(res.data.payload?.headers, "Subject"),
    from: header(res.data.payload?.headers, "From"),
    date: header(res.data.payload?.headers, "Date"),
    snippet: res.data.snippet ?? "",
  }));
}
