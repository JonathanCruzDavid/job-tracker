# Job Application Tracker

A local-first job application tracker built with Next.js and SQLite. It exists to replace a spreadsheet: one place to see every application, its status, and how long it's been waiting for a response — with Gmail doing most of the data entry for you.

## Features

- **Applications dashboard** (`/applications`) — every application in one table: role, company, status, applied date, time to hear back, and a "ghosted" flag for anything stuck with no response. Filter by status, and status counts are shown on each filter pill.
- **Gmail auto-sync** — click "Refresh now" and it scans your inbox for:
  - New applications (confirmation emails), which get added automatically.
  - Replies to applications you're already tracking (rejections, interview requests, offers), which update that application's status automatically.
  - Anything the AI can't confidently classify is left as an "unclear" finding for you to review by hand, instead of guessing.
- **AI-tailored resumes** — generate a resume tailored to a specific job posting (via Claude), preview it as a PDF, iterate on it in a chat-style review, and save it.
- **Resume library** (`/resumes`) — upload a master resume plus as many additional versions as you want (e.g. a Software Engineer vs. Data Analyst variant), each with an inline PDF preview and download link.
- **Scam/legitimacy check** — flags job postings that match common scam patterns before you apply.
- **Browser extension** (`extension/`) — while browsing LinkedIn or Indeed, captures postings into the tracker automatically, and adds a "Track this application" button on real application pages (detected by a resume upload field) to save one with a single click.

## Setup

**Requirements:** Node.js, and a Google Cloud OAuth client if you want Gmail sync.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `ANTHROPIC_API_KEY` — required for resume tailoring, scam checks, and Gmail email classification.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — required for Gmail auto-sync. Create a Web application OAuth client in Google Cloud with the Gmail API enabled; the redirect URI must match `http://localhost:3000/api/gmail/callback`.
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

Data is stored locally in a SQLite database and uploaded resume files under `data/` — neither is committed to this repo (see `.gitignore`).

### Browser extension

1. Go to `chrome://extensions`, enable Developer mode.
2. Click "Load unpacked" and select the `extension/` folder.
3. The extension talks to the tracker at `http://localhost:3000`, so the dev server needs to be running for it to work.

## Tech stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, SQLite (`node:sqlite`), the Anthropic SDK (Claude), and the Gmail API.
