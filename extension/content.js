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
      } else if (response?.error) {
        showToast(`Job Tracker: ${response.error}`, true);
      }
    });
  }

  console.log("[Job Tracker] content script loaded on", location.hostname);
  tryImport();
  setInterval(tryImport, 1500);
})();
