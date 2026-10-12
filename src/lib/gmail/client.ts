import { google, gmail_v1 } from "googleapis";
import { db } from "@/lib/db";
import { createOAuthClient } from "./oauthClient";

export function isGmailConnected(): boolean {
  const row = db.prepare("select id from gmail_connection where id = 1").get();
  return Boolean(row);
}

export function getConnectedEmail(): string | null {
  const row = db.prepare("select connected_email from gmail_connection where id = 1").get() as
    | { connected_email: string | null }
    | undefined;
  return row?.connected_email ?? null;
}

export function getLastCheckedAt(): string | null {
  const row = db.prepare("select last_checked_at from gmail_connection where id = 1").get() as
    | { last_checked_at: string | null }
    | undefined;
  return row?.last_checked_at ?? null;
}

export function disconnectGmail(): void {
  db.prepare("delete from gmail_connection where id = 1").run();
}

export function getGmailClient(): gmail_v1.Gmail {
  const row = db.prepare("select refresh_token from gmail_connection where id = 1").get() as
    | { refresh_token: string }
    | undefined;

  if (!row) {
    throw new Error("Gmail is not connected");
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: row.refresh_token });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
