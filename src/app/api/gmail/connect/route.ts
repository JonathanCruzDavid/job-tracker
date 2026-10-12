import { NextResponse } from "next/server";
import { createOAuthClient, GMAIL_SCOPE } from "@/lib/gmail/oauthClient";

// Kicks off the one-time Google OAuth consent flow. access_type "offline" +
// prompt "consent" guarantees a refresh_token comes back even on a repeat
// connect (Google only issues one on first consent otherwise).
export async function GET() {
  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_SCOPE],
  });

  return NextResponse.redirect(url);
}
