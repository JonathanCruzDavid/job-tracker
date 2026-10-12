// Runs only inside pages the user personally navigated to (LinkedIn/Indeed
// job pages), reading content their own browser already legitimately
// loaded — same category as the bookmarklet, just triggered on page
// render instead of on click. It never navigates anywhere on its own.
(function () {
  const sentUrls = new Set();

  function text(sel) {
    try {
      const el = document.querySelector(sel);
      return el ? el.innerText.trim() : "";
    } catch {
      return "";
    }
  }

  function meta(name) {
    try {
      const el =
        document.querySelector(`meta[property="${name}"]`) ||
        document.querySelector(`meta[name="${name}"]`);
      return el ? el.content.trim() : "";
    } catch {
      return "";
    }
  }

  // CSS classes on sites like LinkedIn are content-hashed and change on
  // every deploy, so exact-class selectors break constantly. This finds
  // "the largest chunk of real content on the page" instead — far more
  // resilient, since it doesn't depend on any specific class/id surviving
  // a redesign. It scores each candidate by its own text minus its
  // largest child's text, so it lands on the most specific container
  // wrapping the content rather than a giant ancestor that includes nav,
  // sidebars, etc.
  function findLargestTextBlock(minLength = 200) {
    try {
      const candidates = document.querySelectorAll("div, section, article, ul");
      let best = "";
      let bestScore = 0;

      for (const el of candidates) {
        if (el.closest("nav, header, footer, aside")) continue;
        const ownText = (el.innerText || "").trim();
        if (ownText.length < minLength) continue;

        let maxChildLen = 0;
        for (const child of el.children) {
          const childLen = (child.innerText || "").trim().length;
          if (childLen > maxChildLen) maxChildLen = childLen;
        }
        const specificity = ownText.length - maxChildLen;

        if (ownText.length > bestScore && specificity > 100) {
          bestScore = ownText.length;
          best = ownText;
        }
      }
      return best;
    } catch {
      return "";
    }
  }

  function isJobUrl(href) {
    return (
      /linkedin\.com\/jobs\/view\//.test(href) ||
      /linkedin\.com\/jobs\/search-results\/.*currentJobId=/.test(href) ||
      /indeed\.com\/(viewjob|.*[?&]vjk=)/.test(href)
    );
  }

  function extract() {
    const host = location.hostname;
    let title = "";
    let company = "";
    let description = "";
    let sourceSite = "Other";

    if (host.indexOf("linkedin.com") !== -1) {
      sourceSite = "LinkedIn";
      title =
        text("h1.job-details-jobs-unified-top-card__job-title") ||
        text(".jobs-unified-top-card__job-title") ||
        text("h1");
      company =
        text(".job-details-jobs-unified-top-card__company-name") ||
        text(".jobs-unified-top-card__company-name");
      description =
        text(".jobs-description__content") ||
        text(".jobs-box__html-content") ||
        text("#job-details") ||
        text('[aria-label="Job description" i]') ||
        text('[class*="description" i]');

      // LinkedIn's document.title reliably follows "Title | Company |
      // LinkedIn" even when the CSS selectors above miss (they change
      // often) — parse it as a fallback for both fields at once.
      if (!title || !company) {
        const parts = document.title.split("|").map((p) => p.trim());
        if (!title && parts[0]) title = parts[0];
        if (!company && parts[1]) company = parts[1];
      }
    } else if (host.indexOf("indeed.com") !== -1) {
      sourceSite = "Indeed";
      title = text('[data-testid="jobsearch-JobInfoHeader-title"]') || text("h1");
      company =
        text('[data-testid="inlineHeader-companyName"]') ||
        text(".jobsearch-InlineCompanyRating");
      description = text("#jobDescriptionText") || text('[class*="jobDescriptionText" i]');
    }

    if (!title) title = meta("og:title") || document.title;
    if (!description || description.length < 100) {
      description = findLargestTextBlock() || description || meta("og:description");
    }

    // Best-effort for arbitrary company career sites (Greenhouse, custom
    // domains, etc.) where there's no known selector for "the company
    // name" the way there is for LinkedIn/Indeed. og:site_name is often
    // the company/brand; failing that, guess from <title>'s "Job Title -
    // Company" / "Company - Job Title" convention. Both are genuinely
    // fuzzy — worth double-checking in the app afterward.
    if (!company) {
      company = meta("og:site_name");
    }
    if (!company) {
      const parts = document.title
        .split(/[-|·]/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        company = parts.find((p) => p.toLowerCase() !== title.toLowerCase()) || parts[parts.length - 1];
      }
    }

    return {
      title,
      company,
      description: description.slice(0, 6000),
      url: location.href,
      sourceSite,
    };
  }

  function showToast(message, isError) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      background: ${isError ? "#dc2626" : "#16a34a"}; color: white;
      padding: 10px 16px; border-radius: 8px; font-size: 14px;
      font-family: system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  let lastLoggedHref = null;

  function tryImport() {
    const href = location.href;
    if (!isJobUrl(href)) {
      return;
    }
    if (sentUrls.has(href)) return;

    const data = extract();

    // Content likely hasn't finished rendering yet — try again on the
    // next poll rather than sending a near-empty import. Log once per URL
    // so it's visible in DevTools what's actually being found.
    if (href !== lastLoggedHref) {
      lastLoggedHref = href;
      console.log("[Job Tracker] checking page:", {
        url: href,
        title: data.title || "(empty)",
        company: data.company || "(empty)",
        descriptionLength: data.description.length,
      });
    }

    if (!data.title || !data.description || data.description.length < 40) return;

    sentUrls.add(href);
    console.log("[Job Tracker] sending import:", data.title, "@", data.company);

    chrome.runtime.sendMessage({ type: "IMPORT_JOB", payload: data }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Job Tracker] message failed:", chrome.runtime.lastError.message);
        return;
      }
      console.log("[Job Tracker] response:", response);
      if (response?.ok) {
        const scoreText =
          typeof response.score === "number" ? ` — score ${response.score}/100` : "";
        const prefix = response.alreadyImported ? "Already tracked" : "Imported";
        showToast(`✓ ${prefix} in Job Tracker${scoreText}`);

        if (response.scamVerdict === "likely_scam") {
          showToast(`⚠ Job Tracker: this posting matches common scam patterns — check it before applying`, true);
        } else if (response.scamVerdict === "uncertain") {
          showToast(`⚠ Job Tracker: this posting has some red flags — worth a closer look`, true);
        }
      } else if (response?.error) {
        showToast(`Job Tracker: ${response.error}`, true);
      }
    });
  }

  // --- Track application button ---
  function injectTrackApplicationButton() {
    if (document.getElementById("job-tracker-mark-applied-btn")) return;

    // Runs on every site now (custom ATS domains like careers.company.com
    // can't be enumerated in advance), so the trigger has to be specific to
    // job applications rather than "any form." A resume/file-upload field is
    // a strong signal — rare on login/signup/checkout pages, near-universal
    // on job applications. Without one (e.g. a multi-step form whose
    // personal-info page comes before the upload step), fall back to
    // requiring a substantial number of fields, since a real application
    // page has far more than a typical login or newsletter form.
    const hasFileUpload = !!document.querySelector('input[type="file"]');
    const fieldCount = document.querySelectorAll("input, textarea, select").length;
    if (!hasFileUpload && fieldCount < 8) return;

    const markBtn = document.createElement("button");
    markBtn.id = "job-tracker-mark-applied-btn";
    markBtn.textContent = "📋 Track this application";
    markBtn.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; z-index: 999999;
      background: #111827; color: white; border: none;
      padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer;
      font-family: system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    `;
    markBtn.addEventListener("click", () => {
      const data = extract();
      if (!data.title || !data.company) {
        showToast(
          `Job Tracker: couldn't confidently read the job title/company on this page`,
          true,
        );
        return;
      }
      markBtn.disabled = true;
      markBtn.textContent = "Tracking...";
      chrome.runtime.sendMessage({ type: "TRACK_APPLICATION", payload: data }, (response) => {
        markBtn.disabled = false;
        markBtn.textContent = "📋 Track this application";
        if (chrome.runtime.lastError) {
          showToast(`Job Tracker: ${chrome.runtime.lastError.message}`, true);
          return;
        }
        if (response?.ok) {
          showToast(
            `✓ Job Tracker: saved "${data.title}" @ ${data.company} — it'll move to Applied once a confirmation email is found`,
          );
        } else {
          showToast(`Job Tracker: ${response?.error ?? "could not track this application"}`, true);
        }
      });
    });
    document.body.appendChild(markBtn);
  }

  function injectLinkedInSessionButton() {
    if (!location.hostname.endsWith("linkedin.com")) return;
    if (document.getElementById("job-tracker-linkedin-session-btn")) return;

    const btn = document.createElement("button");
    btn.id = "job-tracker-linkedin-session-btn";
    btn.textContent = "🔑 Import LinkedIn session";
    btn.title = "Lets the job search agent search LinkedIn using this logged-in session";
    btn.style.cssText = `
      position: fixed; bottom: 20px; left: 280px; z-index: 999999;
      background: #111827; color: white; border: none;
      padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer;
      font-family: system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    `;
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Importing...";
      chrome.runtime.sendMessage({ type: "IMPORT_LINKEDIN_SESSION" }, (response) => {
        btn.disabled = false;
        btn.textContent = "🔑 Import LinkedIn session";
        if (chrome.runtime.lastError) {
          showToast(`Job Tracker: ${chrome.runtime.lastError.message}`, true);
          return;
        }
        if (response?.ok) {
          showToast("✓ Job Tracker: LinkedIn session imported — the search agent can use it now");
        } else {
          showToast(`Job Tracker: ${response?.error ?? "could not import LinkedIn session"}`, true);
        }
      });
    });
    document.body.appendChild(btn);
  }

  console.log("[Job Tracker] content script loaded on", location.hostname);
  tryImport();
  injectTrackApplicationButton();
  injectLinkedInSessionButton();
  setInterval(() => {
    tryImport();
    injectTrackApplicationButton();
    injectLinkedInSessionButton();
  }, 1500);
})();
