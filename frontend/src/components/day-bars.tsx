"use client";

const DECOY_COLORS: Record<string, string> = {
  cowrie: "#2dd4bf",
  "web-portal": "#a3e635",
  heralding: "#38bdf8",
  dionaea: "#f472b6",
};

export type DayDecoyPoint = { day: string; decoy: string; count: number };
export type DayPoint = { day: string; count: number };

export function DayBars({
  days,
  dayDecoys = [],
}: {
  days: DayPoint[];
  dayDecoys?: DayDecoyPoint[];
}) {
  if (!days.length) return null;

  const map = new Map<string, Record<string, number>>();
  for (const item of dayDecoys) {
    if (!map.has(item.day)) map.set(item.day, {});
    const dayMap = map.get(item.day)!;
    dayMap[item.decoy] = (dayMap[item.decoy] || 0) + item.count;
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="flex h-36 items-end gap-1.5 pt-4">
      {days.map((d) => {
        const decoyBreakdown = map.get(d.day) || {};
        const total = d.count;
        const heightPct = Math.round((total / maxCount) * 100);

        return (
          <div key={d.day} className="group relative flex flex-1 flex-col items-center h-full justify-end">
            <div
              style={{ height: `${heightPct}%` }}
              className="w-full flex flex-col-reverse overflow-hidden rounded-t bg-line-strong transition-all group-hover:brightness-125"
            >
              {Object.entries(decoyBreakdown).map(([decoy, count]) => {
                const segmentPct = (count / total) * 100;
                return (
                  <div
                    key={decoy}
                    style={{
                      height: `${segmentPct}%`,
                      backgroundColor: DECOY_COLORS[decoy] || "#e5a93d",
                    }}
                    title={`${decoy}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="pointer-events-none absolute bottom-full mb-2 hidden flex-col items-center rounded bg-surface-2 px-2 py-1 text-[11px] text-fg shadow group-hover:flex z-10 whitespace-nowrap border border-line">
              <span className="font-mono text-brand">{d.day}</span>
              <span className="font-semibold">{total} total events</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
