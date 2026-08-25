type Event = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  resume_id: string | null;
  created_at: string;
};

function describe(event: Event): string {
  switch (event.event_type) {
    case "status_change":
      return `Status changed${event.from_status ? ` from ${event.from_status}` : ""} to ${event.to_status}`;
    case "note_added":
      return "Notes updated";
    case "tailored_resume_generated":
      return event.note ? `Tailored resume saved: ${event.note}` : "Tailored resume saved";
    default:
      return event.event_type;
  }
}

export default function ApplicationTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-black/60 dark:text-white/60">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-black/5 py-1.5 dark:border-white/10">
          <span>
            {describe(event)}
            {event.event_type === "tailored_resume_generated" && event.resume_id && (
              <>
                {" "}
                <a
                  href={`/api/resumes/${event.resume_id}/file`}
                  className="underline"
                >
                  Download
                </a>
              </>
            )}
          </span>
          <span className="flex-shrink-0 text-black/50 dark:text-white/50">
            {new Date(event.created_at).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
