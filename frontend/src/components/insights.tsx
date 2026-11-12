import { visible } from "@/lib/format";

type Step = { label: string; note: string; count: number; color: string };

// How far attackers got, one bar per stage. Every number comes from real sessions.
export function Funnel({ steps }: { steps: Step[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ul className="space-y-5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : 0;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{s.label}</span>
              <span className="tabular-nums">{s.count}</span>
            </div>
            <div className="mt-2 h-2 rounded-sm bg-line">
              <div
                className="h-full rounded-sm"
                style={{ width: `${s.count === 0 ? 0 : Math.max(3, (s.count / top) * 100)}%`, background: s.color }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">
              {s.note}
              {i > 0 && prev > 0 ? `, ${Math.round((s.count / prev) * 100)}% of the step before` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

// Events by hour of day (UTC), built from the latest events.
export function HourHeat({ hours, sample }: { hours: number[]; sample: number }) {
  const max = Math.max(0, ...hours);
  if (max === 0) return <p className="text-sm text-faint">No events yet.</p>;
  const busiest = hours.indexOf(max);
  return (
    <div>
      <div className="grid grid-cols-6 gap-1 sm:grid-cols-12" role="list" aria-label="Events by hour of day, UTC">
        {hours.map((n, h) => {
          const strength = n / max;
          return (
            <div
              key={h}
              role="listitem"
              title={`${pad(h)}:00 UTC, ${n} ${n === 1 ? "event" : "events"}`}
              className={`flex h-10 items-center justify-center rounded-sm text-xs tabular-nums ${
                n === 0 ? "bg-surface-2 text-faint" : strength > 0.5 ? "text-bg" : "text-fg"
              }`}
              style={n > 0 ? { background: `rgba(229,169,61,${(0.18 + strength * 0.82).toFixed(2)})` } : undefined}
            >
              {pad(h)}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted">
        Busiest hour is <span className="font-mono text-fg">{pad(busiest)}:00</span> UTC with {max} {max === 1 ? "event" : "events"}.
      </p>
      <p className="mt-1 text-xs text-faint">Based on the latest {sample} events.</p>
    </div>
  );
}

export type Pair = { user: string; pass: string; count: number; worked: boolean };

// Username and password tried together.
function Cred({ text, what }: { text: string | null | undefined; what: string }) {
  return (text ?? "").trim() === "" ? <span className="text-faint">(empty {what})</span> : <>{visible(text)}</>;
}

export function CredentialPairs({ pairs }: { pairs: Pair[] }) {
  if (pairs.length === 0) return <p className="px-4 py-4 text-sm text-faint">None yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {pairs.map((p) => (
        <li key={`${p.user}\u0000${p.pass}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0 truncate font-mono" title={`${visible(p.user)} / ${visible(p.pass)}`}>
            <Cred text={p.user} what="username" /> <span className="text-faint">/</span> <Cred text={p.pass} what="password" />
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {p.worked && <span className="text-xs text-ok">worked</span>}
            <span className="tabular-nums text-muted">{p.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
