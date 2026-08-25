"use client";

import { useState } from "react";

const BOOKMARKLET_SOURCE = `
(function () {
  function text(sel) {
    try {
      var el = document.querySelector(sel);
      return el ? el.innerText.trim() : "";
    } catch (e) {
      return "";
    }
  }
  function meta(name) {
    try {
      var el = document.querySelector('meta[property="' + name + '"]') ||
               document.querySelector('meta[name="' + name + '"]');
      return el ? el.content.trim() : "";
    } catch (e) {
      return "";
    }
  }

  var host = location.hostname;
  var title = "", company = "", description = "", siteName = "Other";

  if (host.indexOf("linkedin.com") !== -1) {
    siteName = "LinkedIn";
    title = text("h1.job-details-jobs-unified-top-card__job-title") ||
            text(".jobs-unified-top-card__job-title") ||
            text("h1");
    company = text(".job-details-jobs-unified-top-card__company-name") ||
              text(".jobs-unified-top-card__company-name");
    description = text(".jobs-description__content") ||
                   text(".jobs-box__html-content") ||
                   text("#job-details");
  } else if (host.indexOf("indeed.com") !== -1) {
    siteName = "Indeed";
    title = text('[data-testid="jobsearch-JobInfoHeader-title"]') || text("h1");
    company = text('[data-testid="inlineHeader-companyName"]') ||
              text(".jobsearch-InlineCompanyRating");
    description = text("#jobDescriptionText");
  }

  if (!title) title = meta("og:title") || document.title;
  if (!description) description = meta("og:description");

  description = description.slice(0, 6000);

  var params = new URLSearchParams({
    title: title,
    company: company,
    description: description,
    url: location.href,
    sourceSite: siteName,
  });

  window.open("__APP_URL__/jobs/import?" + params.toString(), "_blank");
})();
`.trim();

export default function ImportBookmarklet() {
  const [copied, setCopied] = useState(false);
  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const code = `javascript:${BOOKMARKLET_SOURCE.replace("__APP_URL__", appUrl)}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-8 rounded-md border border-black/10 p-4 dark:border-white/20">
      <p className="mb-2 font-medium">Bookmarklet</p>
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        This creates a bookmark you click while viewing a job posting on LinkedIn or Indeed (in
        your own logged-in browser) — it pulls the title, company, and description into the form
        below automatically. Dragging a bookmarklet link often bookmarks the wrong thing, so set
        it up this way instead:
      </p>
      <ol className="mb-3 list-inside list-decimal text-sm text-black/70 dark:text-white/70">
        <li className="mb-1">Click &quot;Copy code&quot; below</li>
        <li className="mb-1">
          Right-click your bookmarks bar → <strong>Add page</strong> (Chrome) or{" "}
          <strong>Add bookmark</strong>
        </li>
        <li className="mb-1">Name it anything (e.g. &quot;Import job&quot;)</li>
        <li>Paste the copied code into the URL field, then save</li>
      </ol>
      <button
        onClick={handleCopy}
        className="rounded-md border border-black/10 bg-black/5 px-3 py-1.5 text-sm font-medium dark:border-white/20 dark:bg-white/10"
      >
        {copied ? "Copied!" : "Copy code"}
      </button>
      <p className="mt-2 text-xs text-black/50 dark:text-white/50">
        These sites occasionally change their page layout, which can break what gets pulled in —
        if a field comes through empty, just fill it in by hand like before.
      </p>
    </div>
  );
}
