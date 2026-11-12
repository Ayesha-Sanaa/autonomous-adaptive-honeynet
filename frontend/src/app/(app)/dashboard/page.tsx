import type { Metadata } from "next";
import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api";
import type { Attacker, Counted, EventRow, Session, Stats } from "@/lib/types";
import { fillDays, formatDay, formatNumber, formatTime, isPrivateIp, relativeTime, visible } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";
import { AttackMatrix, tacticLabel } from "@/components/attack-matrix";
import { DayBars } from "@/components/day-bars";
import { Donut, PALETTE } from "@/components/donut";
import { CredentialPairs, Funnel, HourHeat, type Pair } from "@/components/insights";
import { DecoyBadge, Empty, PageHeader, Panel, ScannerBadge, StatCell, TechniqueChip, decoyColor, decoyLabel } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

// An attacker with this many events or more is flagged as heavy activity.
const HEAVY_EVENTS = 10;

function Severity({ level }: { level: "High" | "Medium" }) {
  const cls = level === "High" ? "border-danger/40 bg-danger/10 text-danger" : "border-warn/40 bg-warn/10 text-warn";
  return <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{level}</span>;
}

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
  const [stats, attackers, sessions, events] = await Promise.all([
    api<Stats>("/stats"),
    api<Attacker[]>("/attackers?limit=200"),
    api<Session[]>("/sessions?limit=200"),
    api<EventRow[]>("/events?limit=200"),
  ]);

  const recent = events.slice(0, 12);

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

  const byTactic = new Map<string, number>();
  for (const t of techList) byTactic.set(t.tactics[0] ?? "other", (byTactic.get(t.tactics[0] ?? "other") ?? 0) + t.count);

  const breached = sessions.filter((s) => s.login_success);
  const scanners = attackers.filter((a) => a.behaviours.some((b) => b.id === "T1595"));
  const scannerIps = new Set(scanners.map((a) => a.src_ip));
  const heavy = attackers.filter((a) => a.events >= HEAVY_EVENTS && !scannerIps.has(a.src_ip));
  const days = fillDays(stats.by_day, 14);
  const maxAttacker = Math.max(1, ...attackers.map((a) => a.events));
  const now = Date.now();

  const todayCount = days[days.length - 1]?.count ?? 0;
  const active24 = attackers.filter((a) => now - new Date(a.last_seen).getTime() < 86_400_000).length;
  const busiest = attackers.reduce<Attacker | null>((m, a) => (!m || a.events > m.events ? a : m), null);

  const hours = Array.from({ length: 24 }, () => 0);
  for (const e of events) {
    const h = new Date(e.timestamp).getUTCHours();
    if (!Number.isNaN(h)) hours[h] += 1;
  }

  const pairMap = new Map<string, Pair>();
  for (const e of events) {
    if (e.username === undefined || e.password === undefined) continue;
    const key = `${e.username}\u0000${e.password}`;
    const cur = pairMap.get(key) ?? { user: e.username, pass: e.password, count: 0, worked: false };
    cur.count += 1;
    if (e.success) cur.worked = true;
    pairMap.set(key, cur);
  }
  const pairs = [...pairMap.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  const funnel = [
    { label: "Connected", note: "every tracked session", count: sessions.length, color: "#8ba3c7" },
    { label: "Tried to log in", note: "sent a username and password", count: sessions.filter((s) => s.logins.length > 0).length, color: "#e5a93d" },
    { label: "Got in", note: "a login worked on a decoy shell", count: breached.length, color: "#ec8b3c" },
    { label: "Ran commands", note: "typed something in the shell", count: sessions.filter((s) => s.commands.length > 0).length, color: "#f0616d" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AutoRefresh seconds={30} />
      <PageHeader title="Overview" subtitle="Times are UTC. The page refreshes by itself.">
        <p className="text-xs text-faint">Updated {formatTime(new Date())} UTC</p>
      </PageHeader>

      <p className="max-w-3xl text-base text-muted">
        {stats.total === 0 ? (
          "Nothing has touched the decoys yet."
        ) : (
          <>
            So far the decoys captured <span className="text-fg">{formatNumber(stats.total)}</span> events from <span className="text-fg">{formatNumber(attackers.length)}</span> {attackers.length === 1 ? "attacker" : "attackers"}.
            {busiest && <> The most active is <span className="font-mono text-fg">{busiest.src_ip}</span> with {formatNumber(busiest.events)} events, last seen {relativeTime(busiest.last_seen, now)}.</>}
          </>
        )}
      </p>

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
        <StatCell href="/dashboard/decoys" label="Events captured" value={formatNumber(stats.total)} note={`${formatNumber(todayCount)} today, ${stats.by_decoy.length} decoys reporting`} />
        <StatCell href="/dashboard/attackers" label="Attackers" value={formatNumber(attackers.length)} note={`${active24} active in the last 24 hours`} />
        <StatCell href="/dashboard/sessions" label="Sessions" value={formatNumber(sessions.length)} note="tracked connections" />
        <StatCell href="/dashboard/sessions?login=success" label="Logins that worked" value={formatNumber(breached.length)} note="got into a decoy shell" alert={breached.length > 0} />
        <StatCell href="/dashboard/mitre" label="ATT&CK techniques" value={formatNumber(techniques.size)} note="distinct techniques seen" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Events per day" hint={`${formatDay(days[0].day)} to ${formatDay(days[days.length - 1].day)}`} className="xl:col-span-2">
          {stats.total === 0 ? <Empty title="No events yet">They appear here as soon as something touches a decoy.</Empty> : <DayBars days={days} dayDecoys={stats.by_day_decoy} />}
        </Panel>

        <Panel title="Needs attention" hint="open each one" flush>
          <div className="flex h-full flex-col">
            {breached.length === 0 && scanners.length === 0 && heavy.length === 0 ? (
              <Empty title="Nothing to review">No login has worked on a decoy shell, no attacker probed several decoys, and nobody is sending heavy traffic.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {breached.slice(0, 4).map((s) => (
                  <li key={s.session}>
                    <Link href={`/dashboard/sessions/${encodeURIComponent(s.session)}`} className={rowLink}>
                      <div className="min-w-0">
                        <div className="text-sm">Logged in as <span className="font-mono">{visible(s.logins.find((l) => l.success)?.username ?? "unknown")}</span></div>
                        <div className="mt-1 text-xs text-faint">{decoyLabel(s.decoy)}, <span className="font-mono">{s.src_ip}</span>, {s.commands.length} {s.commands.length === 1 ? "command" : "commands"}, {relativeTime(s.start, now)}</div>
                      </div>
                      <Severity level="High" />
                    </Link>
                  </li>
                ))}
                {scanners.slice(0, 3).map((a) => (
                  <li key={a.src_ip}>
                    <Link href={`/dashboard/attackers/${encodeURIComponent(a.src_ip)}`} className={rowLink}>
                      <div className="min-w-0">
                        <div className="text-sm">Probed {a.decoys.length} decoys</div>
                        <div className="mt-1 text-xs text-faint"><span className="font-mono">{a.src_ip}</span>, last seen {relativeTime(a.last_seen, now)}</div>
                      </div>
                      <Severity level="Medium" />
                    </Link>
                  </li>
                ))}
                {heavy.slice(0, 3).map((a) => (
                  <li key={a.src_ip}>
                    <Link href={`/dashboard/attackers/${encodeURIComponent(a.src_ip)}`} className={rowLink}>
                      <div className="min-w-0">
                        <div className="text-sm">Sent {formatNumber(a.events)} events</div>
                        <div className="mt-1 text-xs text-faint"><span className="font-mono">{a.src_ip}</span>, {a.decoys.length} of {stats.by_decoy.length} decoys, last seen {relativeTime(a.last_seen, now)}</div>
                      </div>
                      <Severity level="Medium" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto border-t border-line px-4 py-3 text-xs leading-relaxed text-faint">
              Listed when a login worked on a decoy shell, an attacker probed several decoys, or one address sent {HEAVY_EVENTS} or more events.
            </p>
          </div>
        </Panel>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="How far attackers got" hint="sessions">
          {sessions.length === 0 ? <Empty title="No session yet" /> : <Funnel steps={funnel} />}
        </Panel>
        <Panel title="When attacks happen" hint="hour of day, UTC">
          <HourHeat hours={hours} sample={events.length} />
        </Panel>
        <Panel title="Logins tried together" hint="username / password" flush>
          <CredentialPairs pairs={pairs} />
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
                          {isPrivateIp(a.src_ip) && <span className="rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-faint" title="This address is inside the test cluster network, not on the internet">internal</span>}
                        </div>
                        <span className="text-sm tabular-nums">{formatNumber(a.events)}</span>
                      </div>
                      <div className="h-1 rounded-sm bg-line">
                        <div className="h-full rounded-sm bg-info" style={{ width: `${Math.max(4, (a.events / maxAttacker) * 100)}%` }} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-faint">
                        <span className="flex items-center gap-1" aria-hidden="true">
                          {stats.by_decoy.map((d) => (
                            <span key={d.value} className="size-2 rounded-full" style={{ background: decoyColor(d.value), opacity: a.decoys.includes(d.value) ? 1 : 0.2 }} />
                          ))}
                        </span>
                        {a.decoys.length} of {stats.by_decoy.length} decoys, last seen {relativeTime(a.last_seen, now)}
                      </div>
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
