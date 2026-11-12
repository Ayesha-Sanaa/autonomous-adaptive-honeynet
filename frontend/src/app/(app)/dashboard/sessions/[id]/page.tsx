import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { formatNumber, formatTime, visible } from "@/lib/format";
import { PageHeader, Panel, StatCell, TechniqueChip, Empty } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Session ${decodeURIComponent(id)}` };
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  let session: Session | null = null;
  try {
    session = await api<Session>(`/sessions/${encodeURIComponent(id)}`);
  } catch {
    notFound();
  }

  if (!session) notFound();

  const duration = session.duration_s ?? 0;
  const techniques = session.techniques ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`Session: ${session.session}`}
        subtitle={`Detailed forensic timeline for session established on decoy '${session.decoy}'.`}
      >
        <Link href="/dashboard/sessions" className="text-xs text-muted hover:text-fg">
          &larr; Back to Sessions List
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <StatCell label="Decoy Target" value={session.decoy} note={session.login_success ? "Authentication Access Granted" : "Auth Failed / Probed"} />
        <StatCell label="Attacker IP" value={session.src_ip} note="Click to view IP profile" href={`/dashboard/attackers/${encodeURIComponent(session.src_ip)}`} />
        <StatCell label="Session Duration" value={`${duration}s`} note={`Started ${formatTime(session.start)}`} />
        <StatCell label="Commands Captured" value={formatNumber(session.commands.length)} note={`${session.logins.length} login attempts`} />
      </div>

      <Panel title="Login Credentials Tried">
        {session.logins.length === 0 ? (
          <Empty title="No explicit login attempts recorded" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {session.logins.map((l, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${
                  l.success
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : "border-line bg-surface-2 text-muted"
                }`}
              >
                <span className="font-mono">{visible(l.username)}</span>
                {l.password && <span className="font-mono text-faint">({visible(l.password)})</span>}
                <span className="text-xs font-semibold">{l.success ? "ACCEPTED" : "FAILED"}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Command Execution Timeline" flush>
        {session.commands.length === 0 ? (
          <Empty title="No shell commands executed during this session" />
        ) : (
          <div className="divide-y divide-line font-mono text-sm">
            {session.commands.map((cmd, idx) => {
              const cmdText = typeof cmd === "string" ? cmd : cmd.command;
              return (
                <div key={idx} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2">
                  <span className="text-xs text-faint tabular-nums">#{idx + 1}</span>
                  <span className="text-brand">$</span>
                  <span className="flex-1 text-fg select-all">{visible(cmdText)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {techniques.length > 0 && (
        <Panel title="Matched ATT&CK Techniques">
          <div className="flex flex-wrap gap-2">
            {techniques.map((t) => (
              <TechniqueChip key={t.id} id={t.id} name={t.name} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}