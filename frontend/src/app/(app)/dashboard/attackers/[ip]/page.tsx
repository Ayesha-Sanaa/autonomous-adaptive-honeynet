import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Attacker, EventRow, Session } from "@/lib/types";
import { formatNumber, formatTime, isPrivateIp, relativeTime, visible } from "@/lib/format";
import { CredentialPairs, type Pair } from "@/components/insights";
import { DecoyBadge, Empty, PageHeader, Panel, ScannerBadge, StatCell, TechniqueChip, decoyLabel } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ ip: string }> }): Promise<Metadata> {
  const { ip } = await params;
  return { title: `Attacker ${decodeURIComponent(ip)}` };
}

// Uses the per-address route when the API has it, otherwise finds the address in the attacker list.
async function getAttacker(ip: string): Promise<Attacker | null> {
  try {
    return await api<Attacker>(`/attackers/${encodeURIComponent(ip)}`);
  } catch {
    const all = await api<Attacker[]>("/attackers?limit=200");
    return all.find((a) => a.src_ip === ip) ?? null;
  }
}

const cmdText = (c: string | { command: string }) => (typeof c === "string" ? c : c.command);

export default async function AttackerPage({ params }: { params: Promise<{ ip: string }> }) {
  const { ip: rawIp } = await params;
  const ip = decodeURIComponent(rawIp);

  const [attacker, events, sessions] = await Promise.all([
    getAttacker(ip),
    api<EventRow[]>(`/events?src_ip=${encodeURIComponent(ip)}&limit=100`),
    api<Session[]>("/sessions?limit=200"),
  ]);
  if (!attacker) notFound();

  const now = Date.now();
  const ipSessions = sessions.filter((s) => s.src_ip === ip);
  const breached = ipSessions.filter((s) => s.login_success);
  const commands = ipSessions.flatMap((s) => s.commands.map((c) => ({ text: cmdText(c), session: s.session, decoy: s.decoy })));

  const pairMap = new Map<string, Pair>();
  for (const e of events) {
    if (e.username === undefined || e.password === undefined) continue;
    const key = `${e.username}\u0000${e.password}`;
    const cur = pairMap.get(key) ?? { user: e.username, pass: e.password, count: 0, worked: false };
    cur.count += 1;
    if (e.success) cur.worked = true;
    pairMap.set(key, cur);
  }
  const pairs = [...pairMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={attacker.src_ip} subtitle={`First seen ${formatTime(attacker.first_seen)} UTC, last seen ${relativeTime(attacker.last_seen, now)}.`}>
        <Link href="/dashboard/attackers" className="text-xs text-muted hover:text-fg">&larr; All attackers</Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isPrivateIp(attacker.src_ip) && (
          <span className="rounded border border-line-strong px-2 py-0.5 text-xs text-faint">Internal address. It is inside the test cluster network, not on the internet.</span>
        )}
        {attacker.behaviours.some((b) => b.id === "T1595") && <ScannerBadge />}
        {breached.length > 0 && <span className="rounded border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">Got into a decoy shell {breached.length} {breached.length === 1 ? "time" : "times"}</span>}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <StatCell label="Events" value={formatNumber(attacker.events)} note="captured actions" />
        <StatCell label="Decoys touched" value={`${attacker.decoys.length}`} note={attacker.decoys.map(decoyLabel).join(", ")} />
        <StatCell label="Sessions" value={formatNumber(ipSessions.length)} note={`${breached.length} with a working login`} alert={breached.length > 0} />
        <StatCell label="ATT&CK techniques" value={formatNumber(attacker.techniques.length)} note="matched on this address" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ATT&CK techniques" hint="hits">
          {attacker.techniques.length === 0 && attacker.behaviours.length === 0 ? (
            <Empty title="No technique matched yet" />
          ) : (
            <ul className="space-y-2">
              {attacker.behaviours.map((b) => (
                <li key={b.id} className="flex items-center gap-3 text-sm">
                  <TechniqueChip id={b.id} name={b.name} />
                  <span className="flex-1 truncate text-muted">{b.name}</span>
                  <span className="text-xs text-warn">behaviour</span>
                </li>
              ))}
              {attacker.techniques.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <TechniqueChip id={t.id} name={t.name} />
                  <span className="flex-1 truncate text-muted">{t.name}</span>
                  <span className="tabular-nums text-faint">{t.events}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Logins tried" hint="username / password" flush>
          <CredentialPairs pairs={pairs} />
        </Panel>
      </div>

      <Panel title="Commands typed" hint="in decoy shells" flush>
        {commands.length === 0 ? (
          <Empty title="No commands typed">This address never got a shell, or never typed anything in it.</Empty>
        ) : (
          <ul className="divide-y divide-line font-mono text-sm">
            {commands.map((c, i) => (
              <li key={i}>
                <Link href={`/dashboard/sessions/${encodeURIComponent(c.session)}`} className="smooth flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <span className="text-brand">$</span>
                  <span className="min-w-0 flex-1 truncate">{visible(c.text)}</span>
                  <span className="shrink-0 text-xs text-faint">{decoyLabel(c.decoy)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Sessions" hint="open one for the full story" flush>
        {ipSessions.length === 0 ? (
          <Empty title="No session tracked for this address" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Started (UTC)</th>
                  <th className="px-4 py-2 font-normal">Decoy</th>
                  <th className="px-4 py-2 font-normal">Duration</th>
                  <th className="px-4 py-2 font-normal">Logins</th>
                  <th className="px-4 py-2 font-normal">Commands</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ipSessions.map((s) => (
                  <tr key={s.session} className="smooth hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link href={`/dashboard/sessions/${encodeURIComponent(s.session)}`} className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand">{formatTime(s.start)}</Link>
                    </td>
                    <td className="px-4 py-3"><DecoyBadge decoy={s.decoy} /></td>
                    <td className="px-4 py-3 tabular-nums text-muted">{s.duration_s ?? 0}s</td>
                    <td className="px-4 py-3">
                      <span className={s.login_success ? "font-medium text-danger" : "text-muted"}>{s.logins.length} {s.login_success ? "(one worked)" : s.logins.length === 1 ? "attempt" : "attempts"}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{s.commands.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Latest events" hint={`newest ${events.length}`} flush>
        {events.length === 0 ? (
          <Empty title="No events" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Time (UTC)</th>
                  <th className="px-4 py-2 font-normal">Decoy</th>
                  <th className="px-4 py-2 font-normal">Event</th>
                  <th className="px-4 py-2 font-normal">Detail</th>
                  <th className="px-4 py-2 font-normal">ATT&CK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e._id} className="smooth hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatTime(e.timestamp)}</td>
                    <td className="px-4 py-3"><DecoyBadge decoy={e.decoy} /></td>
                    <td className="px-4 py-3">{e.event_type.replace(/_/g, " ")}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs" title={visible(e.command ?? e.username ?? "")}>
                      {e.command ? visible(e.command) : e.username !== undefined ? (
                        <>
                          {visible(e.username) || <span className="text-faint">(empty)</span>}{" "}
                          <span className={e.success === false ? "text-danger" : e.success ? "text-ok" : "text-faint"}>{e.success === false ? "failed" : e.success ? "accepted" : ""}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{e.attack.map((t) => <TechniqueChip key={t.id} id={t.id} name={t.name} />)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line px-4 py-3 text-xs text-faint">
          <Link href={`/dashboard/events?src_ip=${encodeURIComponent(ip)}`} className="text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">Open all events for this address</Link>
        </div>
      </Panel>
    </div>
  );
}
