export type StatusSegment = {
  label: string;
  count: number;
  colorClass: string;
};

export default function StatusBreakdownChart({ segments }: { segments: StatusSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        No applications yet — this fills in once you&apos;ve applied somewhere.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {segments.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{s.label}</span>
            <span className="text-black/60 dark:text-white/60">
              {s.count} ({Math.round((s.count / total) * 100)}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className={`h-full rounded-full ${s.colorClass}`}
              style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
