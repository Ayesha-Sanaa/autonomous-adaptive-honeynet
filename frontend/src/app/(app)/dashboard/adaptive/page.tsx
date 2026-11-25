import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PageHeader, Panel, Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Adaptive Engine" };

type Decision = {
  _id: string;
  timestamp: string;
  src_ip: string;
  session: string | null;
  phase?: "live" | "final" | string;
  seq?: number | null;
  latency_ms?: number | null;
  action: string;
  fallback: boolean;
  model_version: string;
  top_reasons?: string[];
  applied_action?: { type?: string; target_decoy?: string };
};

type Stats = {
  total: number;
  by_action: Record<string, number>;
  by_phase?: { live?: number; final?: number };
  live_latency_ms?: { count?: number; median?: number | null; p95?: number | null };
  fallback_count: number;
  latest_decision: string | null;
};

const ACTIONS = [
  { key: "maintain", label: "Maintain", note: "Nothing changed" },
  { key: "escalate_tier", label: "Escalate tier", note: "Richer decoy chosen" },
  { key: "plant_breadcrumb", label: "Plant breadcrumb", note: "Fake credential chosen" },
  { key: "observe_only", label: "Observe only", note: "Watch, no interaction" },
];

function utc(ts: string) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toISOString().replace("T", " ").slice(0, 19);
}

export default async function AdaptivePage() {
  let stats: Stats | null = null;
  let decisions: Decision[] = [];
  let failed = false;

  try {
    [stats, decisions] = await Promise.all([
      api<Stats>("/adaptive/stats"),
      api<Decision[]>("/adaptive/decisions?limit=50"),
    ]);
  } catch {
    failed = true;
  }

  const liveCount = stats?.by_phase?.live ?? 0;
  const finalCount = stats?.by_phase?.final ?? 0;
  const medLat = stats?.live_latency_ms?.median;
  const p95Lat = stats?.live_latency_ms?.p95;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Adaptive Engine"
        subtitle="Decisions made during open sessions (live) and at session end (final). If the model fails, the system falls back to maintain."
      />

      {failed || !stats ? (
        <Panel title="Adaptive data">
          <p className="text-sm text-danger">
            Could not load adaptive data from the API. The API may not have the adaptive routes yet.
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title={`Decisions by action (${stats.total} total · live: ${liveCount}, final: ${finalCount})`}
            hint={`Fallbacks: ${stats.fallback_count}${medLat != null ? ` · Live latency med/p95: ${medLat}ms / ${p95Lat}ms` : ""}${stats.latest_decision ? ` · Latest: ${utc(stats.latest_decision)} UTC` : ""}`}
          >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {ACTIONS.map((a) => (
                <div key={a.key}>
                  <div className="text-xs text-faint">{a.label}</div>
                  <div className="mt-1 font-mono text-3xl tabular-nums">{stats.by_action?.[a.key] ?? 0}</div>
                  <div className="mt-1 text-xs text-muted">{a.note}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Latest decisions"
            hint={'"Why" is rule-based, built from the features. It is not produced by the model.'}
            flush
          >
            {decisions.length === 0 ? (
              <Empty title="No decisions yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-line text-xs text-faint">
                    <tr>
                      <th className="px-4 py-2 font-normal">Time (UTC)</th>
                      <th className="px-4 py-2 font-normal">Attacker / session</th>
                      <th className="px-4 py-2 font-normal">Phase / seq</th>
                      <th className="px-4 py-2 font-normal">Action</th>
                      <th className="px-4 py-2 font-normal">Why</th>
                      <th className="px-4 py-2 font-normal">Decoy record</th>
                      <th className="px-4 py-2 font-normal">Model</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {decisions.map((d) => (
                      <tr key={d._id} className="smooth hover:bg-surface-2">
                        <td className="px-4 py-3 font-mono text-xs text-muted">{utc(d.timestamp)}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <div>{d.src_ip}</div>
                          {d.session && <div className="max-w-[160px] truncate text-faint">{d.session}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <div>{d.phase || "final"}{d.seq != null ? ` #${d.seq}` : ""}</div>
                          {d.latency_ms != null && <div className="text-faint">{d.latency_ms}ms</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {d.action}
                          {d.fallback && <span className="ml-2 text-danger">fallback</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {d.top_reasons?.length ? d.top_reasons.join(" · ") : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {d.applied_action?.type ?? "-"}
                          {d.applied_action?.target_decoy ? ` (${d.applied_action.target_decoy})` : ""}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-faint">{d.model_version}</td>
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