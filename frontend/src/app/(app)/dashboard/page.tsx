import type { Metadata } from "next";
import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api";
import type { Attacker, Counted, EventRow, Session, Stats } from "@/lib/types";
import { fillDays, formatDay, formatNumber, formatTime, relativeTime, visible } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";
import { AttackMatrix, tacticLabel } from "@/components/attack-matrix";
import { DayBars } from "@/components/day-bars";
import { Donut, PALETTE } from "@/components/donut";
import { DecoyBadge, Empty, PageHeader, Panel, ScannerBadge, StatCell, TechniqueChip, decoyColor, decoyLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

const rowLink = "smooth flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2";

function TopList({ title, rows, color }: { title: string; rows: Counted[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <h3 className="px-4 pt-4 text-xs font-medium text-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-faint">None yet.</p>
      ) : (
        <ul className="space-y-2 px-4 py-3">
          {rows.slice(0, 6).map((r) => (
            <li key={r.value}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-mono" title={visible(r.value)}>{visible(r.value)}</span>
                <span className="tabular-nums text-muted">{r.count}</span>
              </div>
              <div className="mt-1 h-1 rounded-sm bg-line">
                <div className="h-full rounded-sm" style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, background: color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const techList = [...techniques.values()];

  // Technique hits grouped by their first tactic, for the tactics donut.
  const byTactic = new Map<string, number>();
  for (const t of techList) byTactic.set(t.tactics[0] ?? "other", (byTactic.get(t.tactics[0] ?? "other") ?? 0) + t.count);

  const breached = sessions.filter((s) => s.login_success);
  const scanners = attackers.filter((a) => a.behaviours.some((b) => b.id === "T1595"));
  const days = fillDays(stats.by_day, 14);
  const maxAttacker = Math.max(1, ...attackers.map((a) => a.events));
  const now = Date.now();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AutoRefresh seconds={30} />
      <PageHeader title="Overview" subtitle="Activity across all decoys. Times are UTC and the data refreshes by itself.">
        <p className="text-xs text-faint">Updated {formatTime(new Date())} UTC</p>
      </PageHeader>

      {(breached.length > 0 || scanners.length > 0) && (
        <Link
          href={breached.length > 0 ? "/dashboard/sessions?login=success" : "/dashboard/attackers"}
          className="smooth flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm hover:bg-danger/20"
        >
          <WarningCircle size={20} className="shrink-0 text-danger" />
          <span className="flex-1">
            {breached.length > 0 && <>{breached.length} {breached.length === 1 ? "session" : "sessions"} got a working login on a decoy shell. </>}
            {scanners.length > 0 && <>{scanners.length} {scanners.length === 1 ? "attacker" : "attackers"} probed several decoys in a short time. </>}
            Open the details to see what they did.
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-5">
        <StatCell href="/dashboard/decoys" label="Events captured" value={formatNumber(stats.total)} note={`${stats.by_decoy.length} decoys reporting`} />
        <StatCell href="/dashboard/attackers" label="Attackers" value={formatNumber(attackers.length)} note="unique source IPs" />
        <StatCell href="/dashboard/sessions" label="Sessions" value={formatNumber(sessions.length)} note="tracked connections" />
        <StatCell href="/dashboard/sessions?login=success" label="Logins that worked" value={formatNumber(breached.length)} note="got into a decoy shell" alert={breached.length > 0} />
        <StatCell href="/dashboard/mitre" label="ATT&CK techniques" value={formatNumber(techniques.size)} note="distinct techniques seen" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Events by decoy" hint="click to open">
          {stats.by_decoy.length === 0 ? <Empty title="No decoy has reported yet" /> : (
            <Donut centerLabel="events" slices={stats.by_decoy.map((d) => ({ label: decoyLabel(d.value), value: d.count, color: decoyColor(d.value), href: `/dashboard/decoys#${d.value}` }))} />
          )}
        </Panel>
        <Panel title="What attackers did">
          {stats.by_event_type.length === 0 ? <Empty title="No events yet" /> : (
            <Donut centerLabel="events" slices={stats.by_event_type.slice(0, 6).map((e, i) => ({ label: e.value.replace(/_/g, " "), value: e.count, color: PALETTE[i % PALETTE.length] }))} />
          )}
        </Panel>
        <Panel title="ATT&CK tactics" hint="technique hits">
          {byTactic.size === 0 ? <Empty title="No technique matched yet" /> : (
            <Donut centerLabel="hits" slices={[...byTactic.entries()].sort((a, b) => b[1] - a[1]).map(([t, n], i) => ({ label: tacticLabel(t), value: n, color: PALETTE[i % PALETTE.length], href: `/dashboard/mitre?tactic=${encodeURIComponent(t)}` }))} />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Events per day" hint={`${formatDay(days[0].day)} to ${formatDay(days[days.length - 1].day)}`} className="xl:col-span-2">
          {stats.total === 0 ? <Empty title="No events yet">They appear here as soon as something touches a decoy.</Empty> : <DayBars data={days} />}
        </Panel>

        <Panel title="Needs attention" hint="open each one" flush>
          {breached.length === 0 && scanners.length === 0 ? (
            <Empty title="Nothing to review">No attacker has logged in to a decoy shell, and none has probed several decoys at once.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {breached.slice(0, 4).map((s) => (
                <li key={s.session}>
                  <Link href={`/dashboard/sessions/${encodeURIComponent(s.session)}`} className={rowLink}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-danger" />Logged in as <span className="font-mono">{visible(s.logins.find((l) => l.success)?.username ?? "unknown")}</span></div>
                      <div className="mt-1 text-xs text-faint">{decoyLabel(s.decoy)}, <span className="font-mono">{s.src_ip}</span>, {s.commands.length} {s.commands.length === 1 ? "command" : "commands"}, {relativeTime(s.start, now)}</div>
                    </div>
                  </Link>
                </li>
              ))}
              {scanners.slice(0, 3).map((a) => (
                <li key={a.src_ip}>
                  <Link href={`/dashboard/attackers/${encodeURIComponent(a.src_ip)}`} className={rowLink}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-warn" />Probed {a.decoys.length} decoys</div>
                      <div className="mt-1 text-xs text-faint"><span className="font-mono">{a.src_ip}</span>, last seen {relativeTime(a.last_seen, now)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="ATT&CK coverage" hint="v20.1">
        <p className="mb-4 text-sm text-muted">The columns are the ATT&CK tactics. Filled cells are techniques seen on the decoys, and a stronger colour means more activity. Click a cell to open it.</p>
        {techList.length === 0 ? <Empty title="No technique matched yet" /> : <AttackMatrix techniques={techList} />}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Latest events" hint="newest first" flush className="xl:col-span-2">
          {recent.length === 0 ? (
            <Empty title="No events yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-xs text-faint">
                  <tr>
                    <th className="px-4 py-2 font-normal">Time (UTC)</th>
                    <th className="px-4 py-2 font-normal">Decoy</th>
                    <th className="px-4 py-2 font-normal">Event</th>
                    <th className="px-4 py-2 font-normal">Source</th>
                    <th className="px-4 py-2 font-normal">Detail</th>
                    <th className="px-4 py-2 font-normal">ATT&CK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((e) => (
                    <tr key={e._id} className="smooth hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatTime(e.timestamp)}</td>
                      <td className="px-4 py-3"><DecoyBadge decoy={e.decoy} /></td>
                      <td className="px-4 py-3">{e.event_type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {e.src_ip ? (
                          <Link href={`/dashboard/attackers/${encodeURIComponent(e.src_ip)}`} className="smooth text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand">{e.src_ip}</Link>
                        ) : (
                          <span className="text-faint">unknown</span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs" title={visible(e.command ?? e.username ?? "")}>
                        {e.command ? visible(e.command) : e.username ? (
                          <>
                            {visible(e.username)}{" "}
                            <span className={e.success === false ? "text-danger" : e.success ? "text-ok" : "text-faint"}>
                              {e.success === false ? "failed" : e.success ? "accepted" : ""}
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">{e.attack.map((t) => <TechniqueChip key={t.id} id={t.id} name={t.name} />)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Top attackers" hint="by events" flush>
            {attackers.length === 0 ? (
              <Empty title="No attacker seen yet" />
            ) : (
              <ul className="divide-y divide-line">
                {attackers.slice(0, 6).map((a) => (
                  <li key={a.src_ip}>
                    <Link href={`/dashboard/attackers/${encodeURIComponent(a.src_ip)}`} className={`${rowLink} flex-col items-stretch gap-2`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm">{a.src_ip}</span>
                          {a.behaviours.some((b) => b.id === "T1595") && <ScannerBadge />}
                        </div>
                        <span className="text-sm tabular-nums">{formatNumber(a.events)}</span>
                      </div>
                      <div className="h-1 rounded-sm bg-line">
                        <div className="h-full rounded-sm bg-info" style={{ width: `${Math.max(4, (a.events / maxAttacker) * 100)}%` }} />
                      </div>
                      <div className="text-xs text-faint">{a.decoys.length} of {stats.by_decoy.length} decoys, last seen {relativeTime(a.last_seen, now)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="What attackers tried" hint="most common first" flush>
            <div className="divide-y divide-line">
              <TopList title="Usernames" rows={stats.top_usernames} color="#8ba3c7" />
              <TopList title="Passwords" rows={stats.top_passwords} color="#e5a93d" />
              <TopList title="Commands in the shell" rows={stats.top_commands} color="#b794f6" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
