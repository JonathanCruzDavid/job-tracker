import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type ChromeCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
};

type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

// Chrome's cookies API and Playwright's addCookies() use different shapes
// for the same concepts (sameSite values, expiry as seconds-since-epoch vs.
// "-1 means session cookie") — this is the one place that difference is
// bridged, so both sides can otherwise use their own native format.
function toPlaywrightSameSite(value: string | undefined): "Strict" | "Lax" | "None" {
  if (value === "strict") return "Strict";
  if (value === "no_restriction") return "None";
  return "Lax";
}

function toPlaywrightCookie(cookie: ChromeCookie): PlaywrightCookie {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain.startsWith(".") ? cookie.domain : `.${cookie.domain}`,
    path: cookie.path,
    expires: cookie.expirationDate ?? -1,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: toPlaywrightSameSite(cookie.sameSite),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const cookies = Array.isArray(body?.cookies) ? (body.cookies as ChromeCookie[]) : null;

  if (!cookies || cookies.length === 0) {
    return NextResponse.json(
      { error: "No LinkedIn cookies found — make sure you're logged into LinkedIn in this browser." },
      { status: 400 },
    );
  }

  const hasAuthCookie = cookies.some((c) => c.name === "li_at");
  if (!hasAuthCookie) {
    return NextResponse.json(
      { error: "Missing the LinkedIn login cookie (li_at) — make sure you're actually logged in." },
      { status: 400 },
    );
  }

  const playwrightCookies = cookies.map(toPlaywrightCookie);

  db.prepare(
    `insert into browser_sessions (site, cookies_json, captured_at)
     values ('linkedin', ?, datetime('now', 'localtime'))
     on conflict(site) do update set cookies_json = excluded.cookies_json, captured_at = excluded.captured_at`,
  ).run(JSON.stringify(playwrightCookies));

  return NextResponse.json({ ok: true, cookieCount: playwrightCookies.length });
}
