import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { formatNumber, relativeTime } from "@/lib/format";
import { PageHeader, Panel, DecoyBadge, Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const { login } = await searchParams;
  const sessions = await api<Session[]>("/sessions?limit=200");
  const now = Date.now();

  const filteredSessions = login === "success" 
    ? sessions.filter((s) => s.login_success)
    : sessions;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Interactive Sessions"
        subtitle="Tracked attacker connection sessions across interactive honeynet shells (SSH, RDP, HTTP)."
      />

      <Panel
        title={`All Active & Recorded Sessions (${filteredSessions.length})`}
        hint={login === "success" ? "Filtered: Successful logins only" : "Click session to inspect commands"}
        flush
      >
        {filteredSessions.length === 0 ? (
          <Empty title="No sessions recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Session ID</th>
                  <th className="px-4 py-2 font-normal">Decoy</th>
                  <th className="px-4 py-2 font-normal">Source IP</th>
                  <th className="px-4 py-2 font-normal">Duration</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal">Commands</th>
                  <th className="px-4 py-2 font-normal">Start Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredSessions.map((s) => (
                  <tr key={s.session} className="smooth hover:bg-surface-2">
                    <td className="px-4 py-3 font-mono text-xs max-w-[160px] truncate">
                      <Link
                        href={`/dashboard/sessions/${encodeURIComponent(s.session)}`}
                        className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-brand"
                      >
                        {s.session}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><DecoyBadge decoy={s.decoy} /></td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/dashboard/attackers/${encodeURIComponent(s.src_ip)}`}
                        className="hover:underline"
                      >
                        {s.src_ip}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.duration_s}s</td>
                    <td className="px-4 py-3">
                      {s.login_success ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger border border-danger/30">
                          <span className="size-1.5 rounded-full bg-danger animate-pulse" /> Breached
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Probing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(s.commands.length)}</td>
                    <td className="px-4 py-3 text-muted">{relativeTime(s.start, now)}</td>
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