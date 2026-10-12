import { NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { createOAuthClient } from "@/lib/gmail/oauthClient";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/applications?error=${encodeURIComponent(error)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/applications?error=missing_code", url.origin));
  }

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // Happens if the user had already granted consent before and Google
      // didn't re-issue one — prompt:"consent" on /connect is meant to
      // prevent this, but guard anyway with an actionable message.
      return NextResponse.redirect(new URL("/applications?error=no_refresh_token", url.origin));
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });

    db.prepare(
      `insert into gmail_connection (id, refresh_token, connected_email, connected_at)
       values (1, ?, ?, datetime('now', 'localtime'))
       on conflict(id) do update set
         refresh_token = excluded.refresh_token,
         connected_email = excluded.connected_email,
         connected_at = excluded.connected_at`,
    ).run(tokens.refresh_token, profile.data.emailAddress ?? null);

    return NextResponse.redirect(new URL("/applications?connected=1", url.origin));
  } catch (err) {
    console.error("[gmail/callback] failed", err);
    return NextResponse.redirect(new URL("/applications?error=exchange_failed", url.origin));
  }
}
