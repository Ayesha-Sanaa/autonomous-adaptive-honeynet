import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import type { EventRow } from "@/lib/types";
import { formatTime, visible } from "@/lib/format";
import { PageHeader, Panel, DecoyBadge, TechniqueChip, Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Live Events Log" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ decoy?: string; src_ip?: string; event_type?: string }>;
}) {
  const params = await searchParams;
  let path = "/events?limit=200";
  if (params.decoy) path += `&decoy=${encodeURIComponent(params.decoy)}`;
  if (params.src_ip) path += `&src_ip=${encodeURIComponent(params.src_ip)}`;
  if (params.event_type) path += `&event_type=${encodeURIComponent(params.event_type)}`;

  const events = await api<EventRow[]>(path);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Live Events Telemetry Log"
        subtitle="Real-time security event stream captured across all integrated honeynet decoys."
      />

      <Panel title={`Captured Telemetry Stream (${events.length} events)`} flush>
        {events.length === 0 ? (
          <Empty title="No matching events found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-xs text-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Timestamp (UTC)</th>
                  <th className="px-4 py-2 font-normal">Decoy</th>
                  <th className="px-4 py-2 font-normal">Event Type</th>
                  <th className="px-4 py-2 font-normal">Source IP</th>
                  <th className="px-4 py-2 font-normal">Payload / Command</th>
                  <th className="px-4 py-2 font-normal">ATT&CK Mapping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e._id} className="smooth hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatTime(e.timestamp)}</td>
                    <td className="px-4 py-3"><DecoyBadge decoy={e.decoy} /></td>
                    <td className="px-4 py-3 font-mono text-xs">{e.event_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.src_ip ? (
                        <Link href={`/dashboard/attackers/${encodeURIComponent(e.src_ip)}`} className="hover:underline">
                          {e.src_ip}
                        </Link>
                      ) : (
                        <span className="text-faint">unknown</span>
                      )}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs" title={visible(e.command ?? e.username ?? "")}>
                      {e.command ? visible(e.command) : e.username ? (
                        <span>{visible(e.username)} {e.success !== undefined && (e.success ? "(success)" : "(failed)")}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {e.attack.map((t) => <TechniqueChip key={t.id} id={t.id} name={t.name} />)}
                      </div>
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