import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocumentProxy } from "unpdf";
import { ResumeDocument, SCALE_TIER_COUNT, type ResumeDocumentData } from "./resumeTemplate";

// react-pdf has no "shrink to fit" — content that overflows a page just
// paginates. To guarantee one page, render at each successively tighter
// scale tier and check the actual page count (via the same pdf.js used to
// parse uploaded resumes), stopping at the first tier that fits.
export async function renderResumePdf(resume: ResumeDocumentData): Promise<Buffer> {
  let lastBuffer: Buffer = Buffer.alloc(0);

  for (let scaleIndex = 0; scaleIndex < SCALE_TIER_COUNT; scaleIndex++) {
    const element = React.createElement(ResumeDocument, {
      resume,
      scaleIndex,
    }) as unknown as Parameters<typeof renderToBuffer>[0];
    const buffer = await renderToBuffer(element);
    lastBuffer = buffer;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages <= 1) {
      return buffer;
    }
  }

  // Even the tightest tier still overflowed — return it anyway; it's the
  // most compact version available.
  return lastBuffer;
}
