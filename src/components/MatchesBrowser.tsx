"use client";

import { useMemo, useState } from "react";
import JobMatchCard from "./JobMatchCard";

export type MatchData = {
  matchId: string;
  jobPostingId: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  score: number;
  matchingSkills: string[];
  gaps: string[];
  improvementTips: string[];
  summary: string | null;
};

type SortOrder = "score_desc" | "score_asc";

export default function MatchesBrowser({ matches }: { matches: MatchData[] }) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("score_desc");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = query
      ? matches.filter((match) => {
          const haystack = [
            match.title,
            match.company,
            match.location ?? "",
            match.summary ?? "",
            ...match.matchingSkills,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : matches;

    return [...filtered].sort((a, b) =>
      sortOrder === "score_desc" ? b.score - a.score : a.score - b.score,
    );
  }, [matches, search, sortOrder]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, company, location, or skill..."
          className="flex-1 rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm text-black placeholder:text-black/40 dark:border-white/20 dark:bg-zinc-800 dark:text-white dark:placeholder:text-white/40"
        />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm text-black dark:border-white/20 dark:bg-zinc-800 dark:text-white"
        >
          <option value="score_desc">Most likely first</option>
          <option value="score_asc">Least likely first</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          No matches found for &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((match) => (
            <JobMatchCard
              key={match.matchId}
              matchId={match.matchId}
              jobPostingId={match.jobPostingId}
              title={match.title}
              company={match.company}
              location={match.location}
              url={match.url}
              score={match.score}
              matchingSkills={match.matchingSkills}
              gaps={match.gaps}
              improvementTips={match.improvementTips}
              summary={match.summary}
            />
          ))}
        </div>
      )}
    </div>
  );
}
