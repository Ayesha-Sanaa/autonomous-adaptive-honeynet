import Link from "next/link";
import React from "react";

export function StatCell({
  label,
  value,
  note,
  href,
  className = "",
  alert = false,
}: {
  label: string;
  value: string | number;
  note?: string;
  href?: string;
  className?: string;
  alert?: boolean;
}) {
  const content = (
    <div className={`p-4 ${alert ? "bg-danger/10" : "bg-surface"} ${className}`}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-danger" : "text-fg"}`}>
        {value}
      </div>
      {note && <div className="mt-1 text-xs text-faint truncate">{note}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="smooth block hover:brightness-110">
        {content}
      </Link>
    );
  }
  return content;
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  hint,
  children,
  flush = false,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {hint && <span className="text-xs text-faint font-mono">{hint}</span>}
      </div>
      <div className={`flex-1 ${flush ? "" : "p-4"}`}>{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="p-8 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {children && <p className="mt-1 text-xs text-faint">{children}</p>}
    </div>
  );
}

export function DecoyBadge({ decoy }: { decoy: string }) {
  const colors: Record<string, string> = {
    cowrie: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    "web-portal": "bg-lime-500/10 text-lime-400 border-lime-500/30",
    heralding: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    dionaea: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  };
  const color = colors[decoy] || "bg-brand/10 text-brand border-brand/30";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-medium ${color}`}>
      {decoy}
    </span>
  );
}

export function ScannerBadge() {
  return (
    <span className="inline-flex items-center rounded bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn border border-warn/30">
      RECON / SCANNER
    </span>
  );
}

export function TechniqueChip({ id, name }: { id: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg border border-line" title={name}>
      <span className="text-brand font-semibold">{id}</span>
    </span>
  );
}

export function decoyLabel(decoy: string): string {
  const map: Record<string, string> = {
    cowrie: "Cowrie SSH",
    "web-portal": "Web Portal",
    heralding: "Heralding",
    dionaea: "Dionaea",
  };
  return map[decoy] || decoy;
}

export function decoyColor(decoy: string): string {
  const map: Record<string, string> = {
    cowrie: "#2dd4bf",
    "web-portal": "#a3e635",
    heralding: "#38bdf8",
    dionaea: "#f472b6",
  };
  return map[decoy] || "#e5a93d";
}