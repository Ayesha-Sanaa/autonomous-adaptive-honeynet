import Link from "next/link";

export type Slice = { label: string; value: number; color: string; href?: string };

// Distinct colours that stay readable on the dark background.
export const PALETTE = ["#8ba3c7", "#e5a93d", "#5cc98a", "#b794f6", "#4fd1c5", "#f08fc0", "#f0616d", "#a3e635"];

/** A static donut with the total in the middle and a clickable legend. No animation. */
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={`${centerLabel}: ${total}`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-line)" strokeWidth="16" />
          {slices.map((s) => {
            const len = total ? (s.value / total) * C : 0;
            const shown = Math.max(0, len - 2);
            const el = (
              <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16"
                strokeDasharray={`${shown} ${C - shown}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-xs text-muted">{centerLabel}</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1">
        {slices.map((s) => {
          const body = (
            <>
              <span className="size-2 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tabular-nums text-muted">{s.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-faint">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            </>
          );
          const cls = "flex items-center gap-2 rounded-md px-2 py-1 text-sm";
          return (
            <li key={s.label}>
              {s.href ? <Link href={s.href} className={`smooth ${cls} hover:bg-surface-2`}>{body}</Link> : <div className={cls}>{body}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
