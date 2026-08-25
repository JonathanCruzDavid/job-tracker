import { getDocumentProxy, extractText } from "unpdf";
import mammoth from "mammoth";

// unpdf ships a build of pdf.js compiled specifically for serverless/edge
// runtimes (no worker threads), which sidesteps a real incompatibility
// between pdf-parse's pdfjs-dependent worker loading and Turbopack's
// bundling of Node server code.

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractResumeText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(buffer);
  }
  throw new Error(`Unsupported resume file type: ${mimeType}`);
}
