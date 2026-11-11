import type { Metadata } from "next";
import { api } from "@/lib/api";
import type { Attacker } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { PageHeader, Panel, StatCell, TechniqueChip, Empty } from "@/components/ui";
import { AttackMatrix, tacticLabel } from "@/components/attack-matrix";

export const metadata: Metadata = { title: "ATT&CK Coverage" };

export default async function MitrePage({
  searchParams,
}: {
  searchParams: Promise<{ tactic?: string }>;
}) {
  const { tactic } = await searchParams;
  const attackers = await api<Attacker[]>("/attackers?limit=200");

  const techniques = new Map<string, { id: string; name: string; tactics: string[]; count: number }>();
  const bump = (t: { id: string; name: string; tactics: string[] }, by: number) => {
    const cur = techniques.get(t.id) ?? { ...t, count: 0 };
    cur.count += by;
    techniques.set(t.id, cur);
  };

  for (const a of attackers) {
    for (const t of a.techniques) bump(t, t.events);
    for (const b of a.behaviours) bump(b, 1);
  }

  const techList = [...techniques.values()].sort((a, b) => b.count - a.count);

  const filteredTechs = tactic
    ? techList.filter((t) => t.tactics.includes(tactic))
    : techList;

  const tacticsCount = new Set(techList.flatMap((t) => t.tactics)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="MITRE ATT&CK Matrix & Threat Intelligence"
        subtitle="Automated mapping of adversary tactics, techniques, and procedures (TTPs) captured by honeynet sensors."
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <StatCell label="Techniques Identified" value={formatNumber(techList.length)} note="Distinct TTP matches" />
        <StatCell label="Tactics Covered" value={formatNumber(tacticsCount)} note="Across ATT&CK matrix" />
        <StatCell label="Total Technique Hits" value={formatNumber(techList.reduce((acc, curr) => acc + curr.count, 0))} note="Telemetry mappings" />
        <StatCell label="Framework Standard" value="MITRE ATT&CK v20.1" note="Enterprise Matrix" />
      </div>

      <Panel title="Interactive Heatmap Matrix (v20.1)">
        <p className="mb-4 text-sm text-muted">
          Columns represent ATT&CK tactics. Cell color intensity correlates directly with captured event volume.
        </p>
        {techList.length === 0 ? (
          <Empty title="No MITRE ATT&CK techniques detected yet" />
        ) : (
          <AttackMatrix techniques={techList} />
        )}
      </Panel>

      <Panel
        title={`Observed Techniques Breakdown (${filteredTechs.length})`}
        hint={tactic ? `Filtered by tactic: ${tacticLabel(tactic)}` : "Ranked by event frequency"}
      >
        {filteredTechs.length === 0 ? (
          <Empty title="No techniques matched the selected filter" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTechs.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-surface p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <TechniqueChip id={t.id} name={t.name} />
                    <span className="font-mono text-xs font-semibold text-brand tabular-nums">
                      {t.count} {t.count === 1 ? "hit" : "hits"}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-fg pt-1">{t.name}</h4>
                </div>
                <div className="flex flex-wrap gap-1 border-t border-line pt-2 text-[11px] text-faint">
                  {t.tactics.map((tac) => (
                    <span key={tac} className="rounded bg-surface-2 px-2 py-0.5 font-mono">
                      {tacticLabel(tac)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}