import { db } from "@/lib/db";

export type ExistingApplicationMatch = {
  id: string;
  status: string;
  postingId: string;
};

type Row = { id: string; status: string; postingId: string };

// Same loose, bidirectional substring matching used across the Gmail
// scanning features — the same real job gets written differently by
// different sources ("Metropolitan Transportation Authority" vs "...
// Authority (MTA)", a title with extra trailing text), so exact string
// equality misses real matches too often.
//
// Company-only fallback is ONLY for when no title exists at all (many
// confirmation/rejection emails never state one, e.g. LinkedIn's "your
// application was sent to X"). If a real title was given but genuinely
// doesn't match anything, that's a second, different role at a company
// you've already applied to before, not a duplicate — falling back to
// company-only in that case previously caused a real bug: a second LMI
// application ("Jr. Android Engineer") got silently swallowed into an
// unrelated, already-tracked LMI application ("Health Python Programmer").
export function findExistingApplication(company: string, title: string | null): ExistingApplicationMatch | null {
  if (title) {
    const withTitle = db
      .prepare(
        `select a.id as id, a.status as status, jp.id as postingId
         from job_postings jp
         join applications a on a.job_posting_id = jp.id
         where (
             lower(trim(jp.company)) like '%' || lower(trim(?)) || '%'
             or lower(trim(?)) like '%' || lower(trim(jp.company)) || '%'
           )
           and (
             lower(trim(jp.title)) like '%' || lower(trim(?)) || '%'
             or lower(trim(?)) like '%' || lower(trim(jp.title)) || '%'
             -- A stored placeholder title means no real title was ever
             -- recorded for this posting (see insertion sites), not that a
             -- real title was checked and found not to match — so a new
             -- email with an actual title should still collapse onto it
             -- instead of spawning a second "duplicate" application.
             or lower(trim(jp.title)) = '(role not specified)'
           )
         order by a.created_at desc limit 1`,
      )
      .get(company, company, title, title) as Row | undefined;
    return withTitle ?? null;
  }

  const companyOnly = db
    .prepare(
      `select a.id as id, a.status as status, jp.id as postingId
       from job_postings jp
       join applications a on a.job_posting_id = jp.id
       where (
           lower(trim(jp.company)) like '%' || lower(trim(?)) || '%'
           or lower(trim(?)) like '%' || lower(trim(jp.company)) || '%'
         )
       order by a.created_at desc limit 1`,
    )
    .get(company, company) as Row | undefined;

  return companyOnly ?? null;
}
