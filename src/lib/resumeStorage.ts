import fs from "fs";
import path from "path";

const resumesDir = path.join(process.cwd(), "data", "resumes");
fs.mkdirSync(resumesDir, { recursive: true });

export function saveResumeFile(buffer: Buffer, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  fs.writeFileSync(path.join(resumesDir, fileName), buffer);
  return fileName;
}

export function readResumeFile(storagePath: string): Buffer {
  return fs.readFileSync(path.join(resumesDir, storagePath));
}

export function deleteResumeFile(storagePath: string): void {
  try {
    fs.unlinkSync(path.join(resumesDir, storagePath));
  } catch {
    // Already gone — fine.
  }
}
