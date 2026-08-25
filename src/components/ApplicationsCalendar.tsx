"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CalendarApplication = {
  id: string;
  title: string;
  company: string;
  status: string;
  date: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ApplicationsCalendar({
  applications,
}: {
  applications: CalendarApplication[];
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarApplication[]>();
    for (const app of applications) {
      const list = map.get(app.date) ?? [];
      list.push(app);
      map.set(app.date, list);
    }
    return map;
  }, [applications]);

  const initial = useMemo(() => {
    const latest = applications.reduce<string | null>(
      (max, app) => (!max || app.date > max ? app.date : max),
      null,
    );
    const base = latest ? new Date(`${latest}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  }, [applications]);

  const [cursor, setCursor] = useState(initial);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const now = new Date();
  const todayKey = toDateKey(now.getFullYear(), now.getMonth(), now.getDate());

  function changeMonth(delta: number) {
    setSelectedDay(null);
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const selectedApps = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          className="rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/20"
        >
          ←
        </button>
        <p className="text-sm font-medium">{monthLabel}</p>
        <button
          onClick={() => changeMonth(1)}
          className="rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/20"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-black/50 dark:text-white/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const key = toDateKey(year, month, day);
          const dayApps = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;

          return (
            <button
              key={key}
              onClick={() => dayApps.length > 0 && setSelectedDay(isSelected ? null : key)}
              disabled={dayApps.length === 0}
              className={`flex aspect-square flex-col items-center justify-center rounded-md border text-xs disabled:cursor-default ${
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : dayApps.length > 0
                    ? "border-black/10 bg-black/5 hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20"
                    : "border-black/5 text-black/40 dark:border-white/10 dark:text-white/30"
              } ${isToday && !isSelected ? "ring-1 ring-foreground/50" : ""}`}
            >
              <span>{day}</span>
              {dayApps.length > 0 && <span className="text-[10px] font-semibold">{dayApps.length}</span>}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-4 rounded-md border border-black/10 p-3 dark:border-white/20">
          <p className="mb-2 text-sm font-medium">
            Applied on{" "}
            {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {selectedApps.map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-2">
                <Link href={`/applications/${app.id}`} className="underline">
                  {app.title} · {app.company}
                </Link>
                <span className="flex-shrink-0 text-xs text-black/50 dark:text-white/50">
                  {app.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
