import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "app.db"));
db.exec("PRAGMA foreign_keys = ON;");

const SCHEMA = `
create table if not exists resumes (
  id text primary key,
  is_master integer not null default 0,
  based_on_resume_id text references resumes(id) on delete set null,
  application_id text,
  file_name text not null,
  storage_path text,
  mime_type text not null,
  extracted_text text,
  created_at text not null default (datetime('now', 'localtime'))
);
create unique index if not exists resumes_one_master_idx on resumes(is_master) where is_master = 1;

create table if not exists job_postings (
  id text primary key,
  source text not null check (source in ('manual','adzuna','remoteok')),
  source_site text,
  external_id text,
  title text not null,
  company text not null,
  location text,
  description text,
  url text,
  salary_min integer,
  salary_max integer,
  posted_at text,
  raw_json text,
  created_at text not null default (datetime('now', 'localtime'))
);
create unique index if not exists job_postings_dedup_idx on job_postings(source, external_id) where external_id is not null;

create table if not exists job_matches (
  id text primary key,
  job_posting_id text not null references job_postings(id) on delete cascade,
  resume_id text not null references resumes(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  matching_skills text not null default '[]',
  gaps text not null default '[]',
  improvement_tips text not null default '[]',
  summary text,
  is_contract integer not null default 0,
  status text not null default 'new' check (status in ('new','saved','dismissed')),
  created_at text not null default (datetime('now', 'localtime')),
  unique (job_posting_id, resume_id)
);
create index if not exists job_matches_status_score_idx on job_matches(status, score desc);

create table if not exists applications (
  id text primary key,
  job_posting_id text not null references job_postings(id) on delete cascade,
  tailored_resume_id text references resumes(id) on delete set null,
  status text not null default 'saved' check (status in ('saved','applied','interviewing','offer','rejected','withdrawn')),
  applied_at text,
  interview_stage text,
  notes text,
  created_at text not null default (datetime('now', 'localtime')),
  updated_at text not null default (datetime('now', 'localtime'))
);
create index if not exists applications_status_idx on applications(status);

create table if not exists application_events (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  event_type text not null check (event_type in ('status_change','note_added','tailored_resume_generated')),
  from_status text,
  to_status text,
  note text,
  created_at text not null default (datetime('now', 'localtime'))
);
create index if not exists application_events_application_id_idx on application_events(application_id, created_at desc);

create table if not exists gmail_connection (
  id integer primary key check (id = 1),
  refresh_token text not null,
  connected_email text,
  connected_at text not null default (datetime('now', 'localtime'))
);

create table if not exists gmail_email_reviews (
  email_id text not null,
  application_id text not null references applications(id) on delete cascade,
  match_confidence text not null,
  signal text not null,
  summary text not null,
  subject text not null,
  from_address text not null,
  email_date text not null,
  snippet text not null,
  dismissed integer not null default 0,
  created_at text not null default (datetime('now', 'localtime')),
  primary key (email_id, application_id)
);

create table if not exists browser_sessions (
  site text primary key,
  cookies_json text not null,
  captured_at text not null default (datetime('now', 'localtime'))
);

create table if not exists gmail_application_candidates (
  email_id text primary key,
  subject text not null,
  from_address text not null,
  email_date text not null,
  snippet text not null,
  extracted_company text,
  extracted_title text,
  is_application integer not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at text not null default (datetime('now', 'localtime'))
);
`;

db.exec(SCHEMA);

// One-time cleanup: search_preferences backed a search-source auto-refresh
// feature (Adzuna/RemoteOK) that's been removed in favor of the browser
// extension's live capture. Drop it if an older data/app.db still has it.
db.exec("drop table if exists search_preferences;");

// Safe migration for columns added after someone already has a data/app.db
// file — SQLite's ALTER TABLE ADD COLUMN has no "IF NOT EXISTS", so check
// first (it throws "duplicate column name" on a second run otherwise).
function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`pragma table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

ensureColumn("applications", "interview_stage", "text");
ensureColumn("job_postings", "source_site", "text");
ensureColumn("job_matches", "improvement_tips", "text not null default '[]'");
ensureColumn("application_events", "resume_id", "text references resumes(id) on delete set null");
ensureColumn("job_postings", "scam_verdict", "text");
ensureColumn("job_postings", "scam_risk_score", "integer");
ensureColumn("job_postings", "scam_red_flags", "text");
ensureColumn("job_postings", "scam_reasoning", "text");
ensureColumn("gmail_connection", "last_checked_at", "text");
ensureColumn("gmail_application_candidates", "extracted_outcome", "text");
ensureColumn("job_matches", "is_contract", "integer not null default 0");

db.exec(`
  update application_events
  set resume_id = (
    select r.id from resumes r
    where r.application_id = application_events.application_id
      and r.file_name = application_events.note
    order by r.created_at desc limit 1
  )
  where event_type = 'tailored_resume_generated' and resume_id is null;
`);

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
