// A silent no-response is the norm in high-volume hiring, not the
// exception — most ATS-only applications never get a formal rejection at
// all. 4 weeks with no movement past "applied" is a reasonable line for
// treating it as dead rather than still pending.
export const GHOSTED_AFTER_DAYS = 28;

export function isGhosted(status: string, appliedAt: string | null): boolean {
  if (status !== "applied" || !appliedAt) return false;
  const appliedDate = new Date(appliedAt.replace(" ", "T"));
  const daysSince = (Date.now() - appliedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= GHOSTED_AFTER_DAYS;
}
