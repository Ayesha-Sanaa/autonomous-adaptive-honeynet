import type { Metadata } from "next";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { PageHeader, Panel, StatCell, DecoyBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Decoys Status" };

const DECOY_CONFIG: Record<string, { label: string; protocol: string; ports: string; desc: string }> = {
  cowrie: { label: "Cowrie SSH/Telnet", protocol: "SSH / Telnet", ports: "22, 23", desc: "Medium-interaction SSH & Telnet decoy capturing interactive shell commands, credential brute-forcing, and payload downloads." },
  "web-portal": { label: "Corporate Web Portal", protocol: "HTTP / HTTPS", ports: "80, 443", desc: "Fake enterprise login portal capturing web reconnaissance, SQL injection probes, and authentication attempts." },
  heralding: { label: "Heralding Multi-Service", protocol: "FTP / HTTP / POP3 / SMTP", ports: "21, 110, 25", desc: "Credential-grabbing honeypot capturing plain-text authentication attempts across legacy network protocols." },
  dionaea: { label: "Dionaea Malware Decoy", protocol: "SMB / MSSQL / FTP", ports: "445, 1433", desc: "Low-interaction malware capture decoy detecting network worm propagation and automated exploit payloads." },
};

export default async function DecoysPage() {
  const stats = await api<Stats>("/stats");

  const decoyCounts = new Map<string, number>();
  for (const d of stats.by_decoy) {
    decoyCounts.set(d.value, d.count);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Decoy Infrastructure"
        subtitle="Operational status and captured telemetry metrics across containerized honeynet decoys."
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <StatCell label="Active Decoys" value={formatNumber(stats.by_decoy.length)} note="Deployment healthy" />
        <StatCell label="Total Decoy Events" value={formatNumber(stats.total)} note="Across all protocols" />
        <StatCell label="Network Fabric" value="Kubernetes CNI" note="Isolated honeynet pod mesh" />
        <StatCell label="Cluster Status" value="ONLINE" note="Kind / Honeynet Namespace" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(DECOY_CONFIG).map(([id, cfg]) => {
          const count = decoyCounts.get(id) ?? 0;
          return (
            <Panel key={id} title={cfg.label}>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <DecoyBadge decoy={id} />
                  <span className="font-mono text-xs text-muted">Ports: {cfg.ports}</span>
                </div>
                <p className="text-muted leading-relaxed">{cfg.desc}</p>
                <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                  <span className="text-faint">Protocol: {cfg.protocol}</span>
                  <span className="font-semibold text-brand tabular-nums">{formatNumber(count)} events captured</span>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}