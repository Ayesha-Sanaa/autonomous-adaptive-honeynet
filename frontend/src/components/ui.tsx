import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, hint, children, className = "" }: { title?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
          <h2 className="text-sm font-medium">{title}</h2>
          {hint && <span className="text-xs text-faint">{hint}</span>}
        </header>
      )}
      <div className="p-5 pt-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, icon: Icon, note }: { label: string; value: string; icon: LucideIcon; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between text-muted">
        <span className="text-sm">{label}</span>
        <Icon className="size-4 text-faint" />
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-faint">{note}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-faint">{children}</div>;
}

// One fixed colour per decoy so the same service looks the same on every page.
export const DECOY_COLOR: Record<string, string> = {
  cowrie: "#2dd4bf",
  "web-portal": "#38bdf8",
  heralding: "#fbbf24",
  dionaea: "#a78bfa",
};
export const decoyColor = (d: string) => DECOY_COLOR[d] ?? "#8b9bab";

export function DecoyBadge({ decoy }: { decoy: string }) {
  const c = decoyColor(decoy);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs">
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {decoy}
    </span>
  );
}

export function TechniqueChip({ id, name }: { id: string; name?: string }) {
  return (
    <span title={name} className="rounded-md border border-brand/25 bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand">
      {id}
    </span>
  );
}

/** A label with a proportional bar behind the count. `max` is the largest value in the list. */
export function BarList({ rows, max, mono = false, color = "#2dd4bf" }: { rows: { label: string; count: number }[]; max: number; mono?: boolean; color?: string }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className={`truncate ${mono ? "font-mono text-[13px]" : ""}`} title={r.label}>{r.label}</span>
            <span className="tabular-nums text-muted">{r.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
