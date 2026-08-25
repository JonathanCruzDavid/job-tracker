import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveResumeFile } from "@/lib/resumeStorage";
import { extractResumeText } from "@/lib/resumeParsing";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Please upload a PDF or DOCX file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = saveResumeFile(buffer, file.name);

  let extractedText: string | null = null;
  let warning: string | null = null;
  try {
    extractedText = await extractResumeText(buffer, file.type);
  } catch (err) {
    console.error("[api/resumes] extraction failed", err);
    warning = "Uploaded, but couldn't read the text inside the file.";
  }

  db.prepare("update resumes set is_master = 0 where is_master = 1").run();

  const id = randomUUID();
  db.prepare(
    `insert into resumes (id, is_master, file_name, storage_path, mime_type, extracted_text)
     values (?, 1, ?, ?, ?, ?)`,
  ).run(id, file.name, storagePath, file.type, extractedText);

  return NextResponse.json({ id, warning });
}
