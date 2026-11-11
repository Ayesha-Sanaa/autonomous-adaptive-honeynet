import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Attacker, EventRow, Session } from "@/lib/types";
import { formatNumber, formatTime, relativeTime, visible } from "@/lib/format";
import { PageHeader, Panel, StatCell, DecoyBadge, ScannerBadge, TechniqueChip, Empty } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ ip: string }> }): Promise<Metadata> {
  const { ip } = await params;
  return { title: `Attacker ${decodeURIComponent(ip)}` };
}

export default async function AttackerDetailPage({ params }: { params: Promise<{ ip: string }> }) {
  const { ip: rawIp } = await params;
  const ip = decodeURIComponent(rawIp);

  let attacker: Attacker | null = null;
  let events: EventRow[] = [];
  let sessions: Session[] = [];

  try {
    [attacker, events, sessions] = await Promise.all([
      api<Attacker>(`/attackers/${encodeURIComponent(ip)}`),
      api<EventRow[]>(`/events?src_ip=${encodeURIComponent(ip)}&limit=100`),
      api<Session[]>(`/sessions?limit=200`),
    ]);
  } catch {
    notFound();
  }

  if (!attacker) notFound();

  const ipSessions = sessions.filter((s) => s.src_ip === ip);
  const now = Date.now();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={attacker.src_ip}
        subtitle={`Detailed threat intelligence profile and activity log for IP ${attacker.src_ip}.`}
      >
        <div className="flex items-center gap-2">
          <Link href="/dashboard/attackers" className="text-xs text-muted hover:text-fg">
            &larr; Back to Attackers List
          </Link>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <StatCell label="Total Events" value={formatNumber(attacker.events)} note="captured actions" />
        <StatCell label="Decoys Probed" value={formatNumber(attacker.decoys.length)} note={attacker.decoys.join(", ")} />
        <StatCell label="Sessions Established" value={formatNumber(ipSessions.length)} note="tracked connections" />
        <StatCell label="Techniques Identified" value={formatNumber(attacker.techniques.length)} note="ATT&CK matches" />
      </div>

      {attacker.behaviours.length > 0 && (
        <Panel title="Observed Threat Behaviours">
          <div className="flex flex-wrap gap-2">
            {attacker.behaviours.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded border border-warn/40 bg-warn/10 px-3 py-1.5 text-sm text-warn">
                <ScannerBadge />
                <span className="font-semibold">{b.id}: {b.name}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="ATT&CK Techniques Triggered">
        {attacker.techniques.length === 0 ? (
          <Empty title="No techniques mapped" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {attacker.techniques.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded border border-line bg-surface-2 px-3 py-1.5 text-sm">
                <TechniqueChip id={t.id} name={t.name} />
                <span className="text-xs text-faint">({t.events} hits)</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Sessions" flush>
        {ipSessions.length === 0 ? (
          <Empty title="No active or logged sessions" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Session ID</th>
                  <th className="px-4 py-2 font-normal">Decoy</th>
                  <th className="px-4 py-2 font-normal">Duration</th>
                  <th className="px-4 py-2 font-normal">Logins</th>
                  <th className="px-4 py-2 font-normal">Commands Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ipSessions.map((s) => (
                  <tr key={s.session} className="smooth hover:bg-surface-2">
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[150px]">{s.session}</td>
                    <td className="px-4 py-3"><DecoyBadge decoy={s.decoy} /></td>
                    <td className="px-4 py-3 tabular-nums">{s.duration_s}s</td>
                    <td className="px-4 py-3">
                      <span className={s.login_success ? "text-danger font-semibold" : "text-muted"}>
                        {s.logins.length} {s.login_success ? "(Breached)" : "attempts"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.commands.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent Events Log" flush>
        {events.length === 0 ? (
          <Empty title="No recent events" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Time (UTC)</th>
                  <th className="px-4 py-2 font-normal">Decoy</th>
                  <th className="px-4 py-2 font-normal">Event Type</th>
                  <th className="px-4 py-2 font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e._id} className="smooth hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatTime(e.timestamp)}</td>
                    <td className="px-4 py-3"><DecoyBadge decoy={e.decoy} /></td>
                    <td className="px-4 py-3">{e.event_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[300px]">
                      {e.command ? visible(e.command) : e.username ? visible(e.username) : "-"}
                    </td>
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