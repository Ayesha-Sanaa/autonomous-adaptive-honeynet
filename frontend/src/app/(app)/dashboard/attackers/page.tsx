import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Attacker, Session } from "@/lib/types";
import { formatNumber, isPrivateIp, relativeTime } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";
import { Empty, PageHeader, Panel, ScannerBadge, decoyColor, decoyLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Attackers" };

const DECOYS = ["cowrie", "web-portal", "heralding", "dionaea"];

export default async function AttackersPage() {
  const [attackers, sessions] = await Promise.all([
    api<Attacker[]>("/attackers?limit=200"),
    api<Session[]>("/sessions?limit=200"),
  ]);
  const now = Date.now();
  const breachedIps = new Set(sessions.filter((s) => s.login_success).map((s) => s.src_ip));
  const sorted = [...attackers].sort((a, b) => b.events - a.events);
  const max = Math.max(1, ...sorted.map((a) => a.events));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AutoRefresh seconds={30} />
      <PageHeader title="Attackers" subtitle="Every address that touched a decoy, busiest first. Open one to see everything it did." />

      <Panel title={`${formatNumber(sorted.length)} ${sorted.length === 1 ? "attacker" : "attackers"}`} hint="by events" flush>
        {sorted.length === 0 ? (
          <Empty title="No attacker seen yet">Addresses appear here as soon as something touches a decoy.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Address</th>
                  <th className="px-4 py-2 font-normal">Events</th>
                  <th className="px-4 py-2 font-normal">Decoys touched</th>
                  <th className="px-4 py-2 font-normal">Techniques</th>
                  <th className="px-4 py-2 font-normal">First seen</th>
                  <th className="px-4 py-2 font-normal">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted.map((a) => (
                  <tr key={a.src_ip} className="smooth hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/dashboard/attackers/${encodeURIComponent(a.src_ip)}`} className="font-mono text-sm text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand">
                          {a.src_ip}
                        </Link>
                        {isPrivateIp(a.src_ip) && <span className="rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-faint" title="This address is inside the test cluster network, not on the internet">internal</span>}
                        {a.behaviours.some((b) => b.id === "T1595") && <ScannerBadge />}
                        {breachedIps.has(a.src_ip) && <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger">got in</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 tabular-nums">{formatNumber(a.events)}</span>
                        <div className="h-1 w-24 rounded-sm bg-line">
                          <div className="h-full rounded-sm bg-info" style={{ width: `${Math.max(4, (a.events / max) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5" title={a.decoys.map(decoyLabel).join(", ")}>
                        {DECOYS.map((d) => (
                          <span key={d} className="size-2.5 rounded-full" style={{ background: decoyColor(d), opacity: a.decoys.includes(d) ? 1 : 0.18 }} />
                        ))}
                        <span className="ml-1 text-xs text-faint">{a.decoys.length} of {DECOYS.length}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{a.techniques.length}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{relativeTime(a.first_seen, now)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{relativeTime(a.last_seen, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
