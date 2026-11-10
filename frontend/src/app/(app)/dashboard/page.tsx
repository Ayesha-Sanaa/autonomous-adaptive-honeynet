import type { Metadata } from "next";
import { Activity, KeyRound, Network, ShieldAlert, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Attacker, EventRow, Session, Stats } from "@/lib/types";
import { fillDays, formatNumber, formatTime, relativeTime } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";
import { TimelineChart } from "@/components/timeline-chart";
import { BarList, Card, DecoyBadge, Empty, PageHeader, Stat, TechniqueChip, decoyColor } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const [stats, attackers, sessions, recent] = await Promise.all([
    api<Stats>("/stats"),
    api<Attacker[]>("/attackers?limit=200"),
    api<Session[]>("/sessions?limit=200"),
    api<EventRow[]>("/events?limit=12"),
  ]);

  // Every technique seen, from single events and from attacker behaviour, counted once per attacker/session.
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
  const topTechniques = [...techniques.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const compromised = sessions.filter((s) => s.login_success).length;
  const days = fillDays(stats.by_day, 14);
  const maxDecoy = Math.max(1, ...stats.by_decoy.map((d) => d.count));
  const now = Date.now();

  return (
    <div className="mx-auto max-w-7xl">
      <AutoRefresh seconds={30} />
      <PageHeader title="Overview" subtitle="What is hitting the decoys right now. Times are UTC and the page refreshes by itself.">
        <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-ok" />
          </span>
          Live
        </span>
      </PageHeader>

      <div className="fade-up grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Events captured" value={formatNumber(stats.total)} icon={Activity} note={`${stats.by_decoy.length} decoys reporting`} />
        <Stat label="Attackers" value={formatNumber(attackers.length)} icon={Users} note="unique source IPs" />
        <Stat label="Sessions" value={formatNumber(sessions.length)} icon={Network} note="tracked connections" />
        <Stat label="Logins that worked" value={formatNumber(compromised)} icon={KeyRound} note="attacker got into a decoy shell" />
        <Stat label="ATT&CK techniques" value={formatNumber(techniques.size)} icon={ShieldAlert} note="distinct techniques seen" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Events per day" hint="last 14 days" className="lg:col-span-2">
          {stats.total === 0 ? <Empty>No events yet. They appear here as soon as something touches a decoy.</Empty> : <TimelineChart data={days} />}
        </Card>
        <Card title="Events by decoy">
          {stats.by_decoy.length === 0 ? (
            <Empty>No decoy has reported yet.</Empty>
          ) : (
            <ul className="space-y-4">
              {stats.by_decoy.map((d) => (
                <li key={d.value}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <DecoyBadge decoy={d.value} />
                    <span className="tabular-nums text-muted">{formatNumber(d.count)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (d.count / maxDecoy) * 100)}%`, background: decoyColor(d.value) }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Top MITRE ATT&CK techniques" hint="ATT&CK v20.1">
          {topTechniques.length === 0 ? (
            <Empty>No technique matched yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {topTechniques.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <TechniqueChip id={t.id} />
                  <span className="min-w-0 flex-1 truncate text-sm" title={t.name}>{t.name}</span>
                  <span className="hidden text-xs capitalize text-faint sm:block">{t.tactics[0]?.replace(/-/g, " ")}</span>
                  <span className="w-8 text-right text-sm tabular-nums text-muted">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Top attackers" hint="by events">
          {attackers.length === 0 ? (
            <Empty>No attacker seen yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-faint">
                  <tr>
                    <th className="pb-2 font-normal">Source IP</th>
                    <th className="pb-2 font-normal">Decoys</th>
                    <th className="pb-2 font-normal">Last seen</th>
                    <th className="pb-2 text-right font-normal">Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {attackers.slice(0, 6).map((a) => (
                    <tr key={a.src_ip}>
                      <td className="py-2.5 font-mono text-[13px]">
                        {a.src_ip}
                        {a.behaviours.some((b) => b.id === "T1595") && (
                          <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 font-sans text-[10px] font-medium text-warn">scanner</span>
                        )}
                      </td>
                      <td className="py-2.5 text-muted">{a.decoys.length} of {stats.by_decoy.length}</td>
                      <td className="py-2.5 text-muted">{relativeTime(a.last_seen, now)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatNumber(a.events)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Usernames tried">
          {stats.top_usernames.length === 0 ? <Empty>None yet.</Empty> : <BarList mono rows={stats.top_usernames.map((r) => ({ label: r.value, count: r.count }))} max={stats.top_usernames[0].count} />}
        </Card>
        <Card title="Passwords tried">
          {stats.top_passwords.length === 0 ? <Empty>None yet.</Empty> : <BarList mono color="#fbbf24" rows={stats.top_passwords.map((r) => ({ label: r.value, count: r.count }))} max={stats.top_passwords[0].count} />}
        </Card>
        <Card title="Commands run in the shell">
          {stats.top_commands.length === 0 ? <Empty>No command yet.</Empty> : <BarList mono color="#a78bfa" rows={stats.top_commands.map((r) => ({ label: r.value, count: r.count }))} max={stats.top_commands[0].count} />}
        </Card>
      </div>

      <Card title="Latest events" hint="newest first" className="mt-4">
        {recent.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="px-1 pb-2 font-normal">Time (UTC)</th>
                  <th className="px-1 pb-2 font-normal">Decoy</th>
                  <th className="px-1 pb-2 font-normal">Event</th>
                  <th className="px-1 pb-2 font-normal">Source</th>
                  <th className="px-1 pb-2 font-normal">Detail</th>
                  <th className="px-1 pb-2 font-normal">ATT&CK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((e) => (
                  <tr key={e._id}>
                    <td className="whitespace-nowrap px-1 py-2.5 text-muted">{formatTime(e.timestamp)}</td>
                    <td className="px-1 py-2.5"><DecoyBadge decoy={e.decoy} /></td>
                    <td className="px-1 py-2.5">{e.event_type.replace(/_/g, " ")}</td>
                    <td className="px-1 py-2.5 font-mono text-[13px] text-muted">{e.src_ip ?? "unknown"}</td>
                    <td className="max-w-[220px] truncate px-1 py-2.5 font-mono text-[13px]" title={e.command ?? e.username ?? ""}>
                      {e.command ?? (e.username ? `${e.username}${e.success === false ? " (failed)" : e.success ? " (ok)" : ""}` : "")}
                    </td>
                    <td className="px-1 py-2.5">
                      <div className="flex flex-wrap gap-1">{e.attack.map((t) => <TechniqueChip key={t.id} id={t.id} name={t.name} />)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
