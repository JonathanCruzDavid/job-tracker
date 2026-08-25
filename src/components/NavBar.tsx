import Link from "next/link";

// Ordered to match the actual pipeline: a job comes in (Import), gets
// reviewed (Matches), gets queued (Saved), then tracked through to an
// outcome (Applications). Resumes is setup, not part of the flow, so it
// sits last.
const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs/import", label: "Import job" },
  { href: "/matches", label: "Matches" },
  { href: "/saved", label: "Saved" },
  { href: "/applications", label: "Applications" },
  { href: "/resumes", label: "Resumes" },
];

export default function NavBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[.06] bg-white/80 backdrop-blur-md dark:border-white/[.08] dark:bg-black/60">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
        <Link href="/dashboard" className="flex-shrink-0 font-semibold tracking-tight">
          Job Tracker
        </Link>
        <div className="flex items-center gap-5 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex-shrink-0 whitespace-nowrap text-black/70 transition hover:text-black dark:text-white/70 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
