import { NextResponse } from "next/server";
import { dismissReview } from "@/lib/gmail/emailReviews";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const applicationId = body?.applicationId as string | undefined;
  const emailId = body?.emailId as string | undefined;

  if (!applicationId || !emailId) {
    return NextResponse.json({ error: "applicationId and emailId are required" }, { status: 400 });
  }

  dismissReview(emailId, applicationId);
  return NextResponse.json({ ok: true });
}
