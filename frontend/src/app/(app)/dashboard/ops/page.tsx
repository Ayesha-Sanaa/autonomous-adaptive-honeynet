import type { Metadata } from "next";
import { api } from "@/lib/api";
import type { OpsSummary } from "@/lib/types";
import { PageHeader, Panel, StatCell, Empty } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Operations" };

function fmtAge(sec: number | null) {
  if (sec == null) return "none recorded";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${(sec / 3600).toFixed(1)}h ago`;
}

export default async function OpsPage() {
  let ops: OpsSummary | null = null;
  let failed = false;
  try {
    ops = await api<OpsSummary>("/ops");
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Operations &amp; Reliability"
        subtitle="Decision latency, fallback rate, collector source lag, RL sidecar health, CRDT peers, and MongoDB backup age."
      />

      {failed || !ops ? (
        <Panel title="Operations status">
          <p className="text-sm text-danger">Could not load /ops from the API.</p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
            <StatCell
              label="Decision Latency (med / p95)"
              value={ops.decision_latency_ms.median != null ? `${ops.decision_latency_ms.median}ms` : "-"}
              note={ops.decision_latency_ms.p95 != null ? `p95: ${ops.decision_latency_ms.p95}ms (${ops.decision_latency_ms.count} live)` : "No live samples yet"}
            />
            <StatCell
              label="Fallback Rate"
              value={`${(ops.fallback_rate * 100).toFixed(1)}%`}
              note={`${ops.fallback_count} / ${ops.total_decisions} decisions`}
              alert={ops.fallback_rate > 0.2}
            />
            <StatCell
              label="RL Sidecar"
              value={ops.sidecar.model_loaded ? "Healthy" : ops.sidecar.status || "Down"}
              note={ops.sidecar.model_loaded ? "ONNX loaded" : "Fallback active"}
              alert={!ops.sidecar.model_loaded}
            />
            <StatCell
              label="Last MongoDB Backup"
              value={fmtAge(ops.last_backup_age_s)}
              note={`${ops.crdt.nodes_up}/${ops.crdt.nodes_total} CRDT sidecars up`}
            />
          </div>

          <Panel title="Collector source lag" hint="per log source" flush>
            {ops.collector_sources.length === 0 ? (
              <Empty title="No collector heartbeat recorded yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-line text-xs text-faint">
                    <tr>
                      <th className="px-4 py-2 font-normal">Source</th>
                      <th className="px-4 py-2 font-normal">Byte Offset</th>
                      <th className="px-4 py-2 font-normal">Poll Lag</th>
                      <th className="px-4 py-2 font-normal">Last Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ops.collector_sources.map((s) => (
                      <tr key={s.decoy} className="smooth hover:bg-surface-2">
                        <td className="px-4 py-2.5 font-mono text-xs">{s.decoy}</td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{s.offset}</td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{s.lag_s != null ? `${s.lag_s}s` : "-"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted">{s.last_event_at || "none yet"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
