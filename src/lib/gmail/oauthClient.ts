import { google } from "googleapis";

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/gmail/callback";

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local to use Gmail checking",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
