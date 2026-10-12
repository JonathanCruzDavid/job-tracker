// Runs the actual fetch to the local app. Requests from a background
// service worker to a host declared in manifest.json's host_permissions
// are exempt from CORS enforcement — the content script itself couldn't
// make this cross-origin request, which is why it hands off here instead.
const APP_URL = "http://localhost:3000";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "IMPORT_JOB") {
    fetch(`${APP_URL}/api/jobs/manual-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then((res) => res.json().then((body) => ({ ok: res.ok, ...body })))
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));

    return true; // keep the message channel open for the async sendResponse
  }

  if (message.type === "TRACK_APPLICATION") {
    // Closes the gap between "clicked Autofill and submitted a form" and
    // "the tracker knows this job exists" — imports the job if it isn't
    // already tracked (or reuses the existing posting/match) and saves it
    // as an application. Deliberately stops at "saved," not "applied" —
    // "applied" only gets set once a real confirmation email is found via
    // /api/gmail/scan-applications/confirm, never manually.
    (async () => {
      try {
        const importRes = await fetch(`${APP_URL}/api/jobs/manual-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.payload),
        });
        const importBody = await importRes.json();
        if (!importRes.ok) {
          sendResponse({ ok: false, error: importBody.error || "Import failed" });
          return;
        }

        let applicationId = importBody.applicationId;

        if (!applicationId && importBody.matchId) {
          const saveRes = await fetch(`${APP_URL}/api/matches/${importBody.matchId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save" }),
          });
          const saveBody = await saveRes.json();
          if (!saveRes.ok) {
            sendResponse({ ok: false, error: saveBody.error || "Could not save the match" });
            return;
          }
          applicationId = saveBody.applicationId;
        }

        if (!applicationId) {
          sendResponse({ ok: false, error: "No application could be created" });
          return;
        }

        sendResponse({ ok: true, applicationId });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();

    return true;
  }

  if (message.type === "IMPORT_LINKEDIN_SESSION") {
    // Reads the real cookies from your actual logged-in LinkedIn session
    // (requires the "cookies" permission) and hands them to the local app so
    // the search agent's headless browser can reuse the same session instead
    // of needing your password. domain filter also catches subdomains like
    // www.linkedin.com since chrome.cookies matches by suffix.
    chrome.cookies
      .getAll({ domain: "linkedin.com" })
      .then((cookies) =>
        fetch(`${APP_URL}/api/jobs/linkedin-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies }),
        }),
      )
      .then((res) => res.json().then((body) => ({ ok: res.ok, ...body })))
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));

    return true;
  }

  return false;
});
