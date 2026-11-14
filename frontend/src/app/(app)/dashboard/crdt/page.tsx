import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Shared Attacker State" };

type Node = { name: string; up: boolean; ips: number };

type SharedIp = {
  ip: string;
  level: number;
  last_seen: string | null;
  last_decoy: string | null;
  decoys: string[];
  total_events: number;
};

type Overview = {
  nodes_total: number;
  nodes_up: number;
  nodes: Node[];
  ips_total: number;
  ips: SharedIp[];
};

const LEVELS: Record<number, string> = {
  1: "Connected",
  2: "Login attempt",
  3: "Login success",
  4: "Ran commands",
};

function utc(ts: string | null) {
  if (!ts) return "unknown";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "unknown" : d.toISOString().replace("T", " ").slice(0, 19);
}

export default async function CrdtPage() {
  let data: Overview | null = null;
  let failed = false;

  try {
    data = await api<Overview>("/crdt");
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Shared Attacker State"
        subtitle="Each decoy runs a small CRDT sidecar. They exchange what they have seen about each attacker IP and merge it, so every decoy ends up with the same picture without a central database."
      />

      {failed || !data ? (
        <Panel title="Shared state">
          <p className="text-sm text-danger">
            Could not load shared state from the API. Check that the API is running and the CRDT sidecars are up.
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title={`Sidecars (${data.nodes_up} of ${data.nodes_total} reachable)`}
            hint="Each sidecar reports how many attacker IPs it knows about"
          >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.nodes.map((n) => (
                <div key={n.name}>
                  <div className="text-xs text-faint">{n.name}</div>
                  <div className="mt-1 font-mono text-3xl tabular-nums">{n.up ? n.ips : "-"}</div>
                  <div className={`mt-1 text-xs ${n.up ? "text-muted" : "text-danger"}`}>
                    {n.up ? "IPs known" : "Unreachable"}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={`Attacker IPs known across decoys (${data.ips_total})`} hint="Merged from all sidecars">
            {data.ips.length === 0 ? (
              <p className="text-sm text-muted">No attackers seen yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-faint">
                    <tr>
                      <th className="py-2 pr-4 font-medium">IP</th>
                      <th className="py-2 pr-4 font-medium">Highest level</th>
                      <th className="py-2 pr-4 font-medium">Seen by</th>
                      <th className="py-2 pr-4 font-medium">Events</th>
                      <th className="py-2 pr-4 font-medium">Last seen (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ips.map((r) => (
                      <tr key={r.ip} className="border-t border-line">
                        <td className="py-2 pr-4 font-mono">{r.ip}</td>
                        <td className="py-2 pr-4">
                          {r.level} - {LEVELS[r.level] ?? "Unknown"}
                        </td>
                        <td className="py-2 pr-4">{r.decoys.join(", ")}</td>
                        <td className="py-2 pr-4 font-mono tabular-nums">{r.total_events}</td>
                        <td className="py-2 pr-4 font-mono text-muted">
                          {utc(r.last_seen)}
                          {r.last_decoy ? ` (${r.last_decoy})` : ""}
                        </td>
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