// SQLite's own datetime('now') and JS's toISOString() are both UTC, but
// this is a single-user local app running in the user's own timezone —
// storing anything in UTC means an evening action (e.g. a rejection email
// that arrived at 10:45pm Eastern) lands on the *next* calendar day once
// converted, and the dashboard calendar then shows it happening
// "tomorrow." Formatting with local getFullYear/getMonth/etc. (not
// toISOString) keeps stored timestamps on the same day a human would say
// the event happened.
export function toLocalSqliteDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
