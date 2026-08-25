// Runs the actual fetch to the local app. Requests from a background
// service worker to a host declared in manifest.json's host_permissions
// are exempt from CORS enforcement — the content script itself couldn't
// make this cross-origin request, which is why it hands off here instead.
const APP_URL = "http://localhost:3000";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "IMPORT_JOB") return false;

  fetch(`${APP_URL}/api/jobs/manual-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload),
  })
    .then((res) => res.json().then((body) => ({ ok: res.ok, ...body })))
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));

  return true; // keep the message channel open for the async sendResponse
});
