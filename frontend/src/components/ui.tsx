import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, hint, children, className = "", flush = false }: { title?: string; hint?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <span className="text-xs text-faint">{hint}</span>}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function StatCell({ href, label, value, note, className = "", alert = false }: { href: string; label: string; value: string; note: string; className?: string; alert?: boolean }) {
  return (
    <Link href={href} className={`smooth bg-surface p-4 hover:bg-surface-2 ${className}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${alert ? "text-danger" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-faint">{note}</div>
    </Link>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

// One fixed colour per decoy so the same service looks the same on every page.
export const DECOY_COLOR: Record<string, string> = {
  cowrie: "#2dd4bf",
  "web-portal": "#a3e635",
  heralding: "#38bdf8",
  dionaea: "#f472b6",
};
export const decoyColor = (d: string) => DECOY_COLOR[d] ?? "#9aa4b2";
export const decoyLabel = (d: string) => d.replace(/-/g, " ");

export function DecoyBadge({ decoy }: { decoy: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="size-2 rounded-full" style={{ background: decoyColor(decoy) }} />
      {decoyLabel(decoy)}
    </span>
  );
}

export function TechniqueChip({ id, name }: { id: string; name?: string }) {
  return (
    <Link
      href={`/dashboard/mitre?technique=${encodeURIComponent(id)}`}
      title={name}
      className="smooth rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg hover:border-brand"
    >
      {id}
    </Link>
  );
}

export function ScannerBadge() {
  return <span className="rounded-md bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn">scanner</span>;
}

// Kept so any older file that still imports Card keeps compiling.
export const Card = Panel;
