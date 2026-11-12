import { formatDay, formatNumber } from "@/lib/format";
import { decoyColor, decoyLabel } from "@/components/ui";

export type DayDecoyPoint = { day: string; decoy: string; count: number };
export type DayPoint = { day: string; count: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Top of the scale: a round, even number so the middle gridline is a whole number too.
function niceMax(m: number): number {
  if (m <= 4) return 4;
  if (m <= 6) return 6;
  if (m <= 8) return 8;
  if (m <= 10) return 10;
  const p = 10 ** Math.floor(Math.log10(m));
  const n = m / p;
  return (n <= 2 ? 2 : n <= 4 ? 4 : n <= 6 ? 6 : n <= 8 ? 8 : 10) * p;
}

/** Events per day as stacked bars (one colour per decoy), with a scale, a count on every bar and a hover breakdown. */
export function DayBars({ days, dayDecoys = [] }: { days: DayPoint[]; dayDecoys?: DayDecoyPoint[] }) {
  if (!days.length) return null;

  const byDay = new Map<string, Record<string, number>>();
  const decoyTotals = new Map<string, number>();
  for (const item of dayDecoys) {
    const m = byDay.get(item.day) ?? {};
    m[item.decoy] = (m[item.decoy] ?? 0) + item.count;
    byDay.set(item.day, m);
    decoyTotals.set(item.decoy, (decoyTotals.get(item.decoy) ?? 0) + item.count);
  }

  const total = days.reduce((s, d) => s + d.count, 0);
  const peak = days.reduce((m, d) => (d.count > m.count ? d : m), days[0]);
  const top = niceMax(Math.max(...days.map((d) => d.count), 1));
  const legend = [...decoyTotals.entries()].sort((a, b) => b[1] - a[1]);
  const last = days.length - 1;

  return (
    <div>
      <p className="text-sm text-muted">
        <span className="text-fg">{formatNumber(total)}</span> {total === 1 ? "event" : "events"} in {days.length} days.
        {peak.count > 0 && <> Busiest day was <span className="text-fg">{formatDay(peak.day)}</span> with {formatNumber(peak.count)}.</>}
      </p>

      <div className="mt-4 flex gap-3">
        <div className="relative h-44 w-8 shrink-0 text-right text-[11px] tabular-nums text-faint" aria-hidden="true">
          <span className="absolute right-0 top-0 -translate-y-1/2">{top}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{top / 2}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
            <div className="absolute inset-x-0 bottom-0 border-t border-line-strong" />

            <div className="absolute inset-0 flex gap-1.5">
              {days.map((d, i) => {
                const parts = Object.entries(byDay.get(d.day) ?? {}).sort((a, b) => b[1] - a[1]);
                const sum = parts.reduce((s, [, n]) => s + n, 0);
                const h = (d.count / top) * 100;
                const edge = i < 3 ? "left-0" : i > last - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
                return (
                  <div key={d.day} tabIndex={0} className="group relative h-full flex-1 outline-none" aria-label={`${formatDay(d.day)}: ${d.count} events`}>
                    {d.count > 0 && (
                      <>
                        <div
                          style={{ height: `${h}%` }}
                          className="absolute inset-x-0.5 bottom-0 flex flex-col-reverse gap-px overflow-hidden rounded-t-sm bg-line-strong transition-[filter] group-hover:brightness-125 group-focus-visible:brightness-125"
                        >
                          {parts.map(([decoy, n]) => (
                            <div key={decoy} style={{ height: `${(n / Math.max(sum, 1)) * 100}%`, background: decoyColor(decoy) }} />
                          ))}
                        </div>
                        <span
                          style={{ bottom: `calc(${h}% + 4px)` }}
                          className="pointer-events-none absolute inset-x-0 text-center text-[11px] font-medium tabular-nums text-muted"
                        >
                          {d.count}
                        </span>
                      </>
                    )}
                    <div className={`pointer-events-none absolute top-0 z-10 hidden min-w-36 rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-lg group-hover:block group-focus-visible:block ${edge}`}>
                      <div className="font-medium text-fg">{formatDay(d.day)}</div>
                      <div className="mt-0.5 text-muted">{d.count === 0 ? "No events" : `${d.count} ${d.count === 1 ? "event" : "events"}`}</div>
                      {parts.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {parts.map(([decoy, n]) => (
                            <li key={decoy} className="flex items-center gap-2">
                              <span className="size-2 rounded-sm" style={{ background: decoyColor(decoy) }} />
                              <span className="flex-1 whitespace-nowrap">{decoyLabel(decoy)}</span>
                              <span className="tabular-nums text-muted">{n}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex gap-1.5 text-center text-[11px] leading-tight text-faint" aria-hidden="true">
            {days.map((d, i) => {
              const [, m, dd] = d.day.split("-").map(Number);
              const isToday = i === last;
              return (
                <div key={d.day} className="flex-1">
                  <div className={`tabular-nums ${isToday ? "font-semibold text-brand" : ""}`}>{dd}</div>
                  <div className="h-3">{isToday ? <span className="text-brand">today</span> : i === 0 || dd === 1 ? MONTHS[m - 1] : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {legend.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
          {legend.map(([decoy, n]) => (
            <li key={decoy} className="flex items-center gap-2">
              <span className="size-2 rounded-sm" style={{ background: decoyColor(decoy) }} />
              {decoyLabel(decoy)} <span className="tabular-nums text-faint">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
