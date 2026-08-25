import fs from "fs";
import path from "path";
import os from "os";

// Reads Chrome's local Bookmarks file directly off disk — this is the
// user's own browser data on their own machine, not a network request to
// any job site, so it carries none of the automated-access concerns that
// fetching LinkedIn/Indeed pages would. It only tells us which URLs the
// user has already chosen to save; getting the actual job content back
// out still requires the user's browser to visit the page (the
// bookmarklet), same as manual import.
const DEFAULT_BOOKMARKS_PATH = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Google",
  "Chrome",
  "User Data",
  "Default",
  "Bookmarks",
);
const BOOKMARKS_PATH = process.env.CHROME_BOOKMARKS_PATH || DEFAULT_BOOKMARKS_PATH;
const FOLDER_NAME = process.env.JOBS_BOOKMARK_FOLDER || "Jobapps";

type BookmarkNode = {
  type: "folder" | "url";
  name: string;
  url?: string;
  children?: BookmarkNode[];
};

export type PendingBookmark = {
  url: string;
  rawTitle: string;
  guessedTitle: string;
  guessedCompany: string | null;
  guessedSourceSite: string;
};

function findFolder(node: BookmarkNode, name: string): BookmarkNode | null {
  if (node.type !== "folder") return null;
  if (node.name === name) return node;
  for (const child of node.children ?? []) {
    const found = findFolder(child, name);
    if (found) return found;
  }
  return null;
}

function guessSourceSite(url: string): string {
  if (url.includes("linkedin.com")) return "LinkedIn";
  if (url.includes("indeed.com")) return "Indeed";
  return "Other";
}

function parseBookmarkName(
  name: string,
  sourceSite: string,
): { title: string; company: string | null } {
  const pipeParts = name
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (sourceSite === "LinkedIn" && pipeParts.length >= 2) {
    return { title: pipeParts[0], company: pipeParts[1] };
  }

  const dashParts = name
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (dashParts.length >= 2) {
    return { title: dashParts[0], company: dashParts[1] };
  }

  return { title: name, company: null };
}

export function getPendingBookmarks(excludeUrls: Set<string>): PendingBookmark[] {
  if (!fs.existsSync(BOOKMARKS_PATH)) return [];

  let data: { roots?: Record<string, BookmarkNode> };
  try {
    data = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ BOOKMARKS_PATH, "utf8"));
  } catch (err) {
    console.error("[bookmarks] could not read/parse Chrome bookmarks file", err);
    return [];
  }

  let folder: BookmarkNode | null = null;
  for (const root of Object.values(data.roots ?? {})) {
    folder = findFolder(root, FOLDER_NAME);
    if (folder) break;
  }
  if (!folder) return [];

  const urlEntries = (folder.children ?? []).filter(
    (c): c is BookmarkNode & { url: string } => c.type === "url" && Boolean(c.url),
  );

  return urlEntries
    .filter((entry) => !excludeUrls.has(entry.url))
    .map((entry) => {
      const sourceSite = guessSourceSite(entry.url);
      const { title, company } = parseBookmarkName(entry.name, sourceSite);
      return {
        url: entry.url,
        rawTitle: entry.name,
        guessedTitle: title,
        guessedCompany: company,
        guessedSourceSite: sourceSite,
      };
    });
}
