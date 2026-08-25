function sanitizeForFileName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildTailoredResumeFileName(company: string | null | undefined): string {
  const now = new Date();
  const dateStamp = `${now.getMonth() + 1}.${now.getDate()}.${String(now.getFullYear()).slice(-2)}`;
  return company
    ? `Jonathan_David_Cruz_Resume_${sanitizeForFileName(company)}_${dateStamp}.pdf`
    : `Jonathan_David_Cruz_Resume_${dateStamp}.pdf`;
}
