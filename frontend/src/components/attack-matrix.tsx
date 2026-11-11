import Link from "next/link";

export type MatrixTechnique = { id: string; name: string; tactics: string[]; count: number };

// Tactic order follows the ATT&CK matrix. Any tactic seen in the data but not listed here is added at the end.
const ORDER = [
  "reconnaissance", "resource-development", "initial-access", "execution", "persistence", "privilege-escalation",
  "stealth", "defense-impairment", "credential-access", "discovery", "lateral-movement", "collection",
  "command-and-control", "exfiltration", "impact",
];
export const tacticLabel = (t: string) => t.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** The ATT&CK matrix with the techniques seen on the decoys filled in. Darker means more activity. */
export function AttackMatrix({ techniques }: { techniques: MatrixTechnique[] }) {
  const seen = new Set(techniques.flatMap((t) => t.tactics));
  const cols = [...ORDER, ...[...seen].filter((t) => !ORDER.includes(t))].filter((c) => techniques.some((t) => t.tactics.includes(c)));
  const max = Math.max(1, ...techniques.map((t) => t.count));

  return (
    <div className="overflow-x-auto">
      <div className="grid divide-x divide-line" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(120px, 1fr))` }}>
        {cols.map((c) => {
          const items = techniques.filter((t) => t.tactics.includes(c)).sort((a, b) => b.count - a.count);
          return (
            <div key={c} className="min-h-40">
              <div className="flex h-12 items-center border-b border-line px-2 text-xs text-muted">{tacticLabel(c)}</div>
              <div className="space-y-1 p-1">
                {items.map((t) => {
                  const pct = 18 + Math.round((t.count / max) * 42);
                  return (
                    <Link
                      key={t.id}
                      href={`/dashboard/mitre?technique=${encodeURIComponent(t.id)}`}
                      title={`${t.name}: ${t.count}`}
                      className="smooth block rounded-sm border border-transparent px-2 py-2 text-xs hover:border-brand"
                      style={{ background: `color-mix(in srgb, var(--color-brand) ${pct}%, var(--color-surface-2))` }}
                    >
                      <div className="font-mono">{t.id}</div>
                      <div className="mt-1 h-8 line-clamp-2 text-muted">{t.name}</div>
                      <div className="mt-1 tabular-nums">{t.count}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}