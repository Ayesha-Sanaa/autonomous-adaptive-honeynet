import { formatDay } from "@/lib/format";

// Colour follows volume: quiet days are blue, busy days amber, the busiest red.
function heat(t: number) {
  return t < 0.5
    ? `color-mix(in srgb, var(--color-brand) ${Math.round(t * 200)}%, var(--color-info))`
    : `color-mix(in srgb, var(--color-danger) ${Math.round((t - 0.5) * 200)}%, var(--color-brand))`;
}

/** Events per day as plain bars. No animation, no curve: each day is a separate count. */
export function DayBars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-44 items-end gap-2" role="img" aria-label={`Events per day for the last ${data.length} days`}>
        {data.map((d) => (
          <div key={d.day} title={`${formatDay(d.day)}: ${d.count} events`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {d.count > 0 && <span className="text-xs text-muted">{d.count}</span>}
            {d.count > 0 ? (
              <div className="w-full rounded-sm" style={{ height: `${Math.max(4, (d.count / max) * 80)}%`, background: heat(d.count / max) }} />
            ) : (
              <div className="h-0.5 w-full bg-line-strong" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-xs text-faint">
        {data.map((d) => (
          <span key={d.day} className="flex-1 text-center">{Number(d.day.slice(8))}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-faint">
        <span>quiet</span>
        <span className="h-1 w-24 rounded-sm" style={{ background: "linear-gradient(to right, var(--color-info), var(--color-brand), var(--color-danger))" }} />
        <span>busy</span>
      </div>
      <table className="sr-only">
        <caption>Events per day</caption>
        <thead><tr><th>Day</th><th>Events</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}><td>{formatDay(d.day)}</td><td>{d.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
