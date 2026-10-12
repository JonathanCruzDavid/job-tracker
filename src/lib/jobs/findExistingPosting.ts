import { db } from "@/lib/db";

// Same loose, bidirectional substring matching as findExistingApplication —
// catches a job_posting that's already sitting in Matches (from the search
// agent or a manual import) even though no application exists for it yet,
// which findExistingApplication alone can't see since it only looks at
// applications. Without this, confirming a Gmail application/rejection for
// a job you'd already had scraped into Matches created a second, duplicate
// posting instead of reusing the one already there.
export function findExistingPosting(company: string, title: string): { id: string } | null {
  const row = db
    .prepare(
      `select id from job_postings
       where (
           lower(trim(company)) like '%' || lower(trim(?)) || '%'
           or lower(trim(?)) like '%' || lower(trim(company)) || '%'
         )
         and (
           lower(trim(title)) like '%' || lower(trim(?)) || '%'
           or lower(trim(?)) like '%' || lower(trim(title)) || '%'
         )
       order by created_at desc limit 1`,
    )
    .get(company, company, title, title) as { id: string } | undefined;

  return row ?? null;
}
