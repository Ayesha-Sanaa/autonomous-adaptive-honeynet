import type { Metadata } from "next";
import Link from "next/link";
import { api, getCurrentUser } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { Empty, PageHeader, Panel } from "@/components/ui";
import { ReportForm } from "./report-form";
import { deleteReport } from "./actions";

export const metadata: Metadata = { title: "Reports" };

type Report = {
  _id: string;
  title: string;
  notes: string;
  severity: "low" | "medium" | "high";
  src_ip: string | null;
  author: string;
  created_at: string;
};

const SEV: Record<Report["severity"], string> = {
  low: "border-line-strong text-muted",
  medium: "border-warn/40 bg-warn/10 text-warn",
  high: "border-danger/40 bg-danger/10 text-danger",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ ip?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  let reports: Report[] = [];
  let failed = false;
  try {
    reports = await api<Report[]>("/reports");
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Incident reports"
        subtitle="Analysts and admins write short reports about what the honeynet caught. Only admins can delete a report."
      />

      <Panel title="New report">
        <ReportForm defaultIp={sp.ip ?? ""} />
      </Panel>

      <Panel title={`Saved reports (${reports.length})`} flush>
        {failed ? (
          <p className="px-4 py-4 text-sm text-danger">Could not load reports from the API.</p>
        ) : reports.length === 0 ? (
          <Empty title="No reports yet">Write the first one above.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              <li key={r._id} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${SEV[r.severity]}`}>{r.severity}</span>
                  <h3 className="text-sm font-medium">{r.title}</h3>
                  <span className="ml-auto text-xs text-faint">{r.author}, {formatTime(r.created_at)} UTC</span>
                </div>
                {r.src_ip ? (
                  <p className="text-xs text-muted">
                    Attacker{" "}
                    <Link href={`/dashboard/attackers/${encodeURIComponent(r.src_ip)}`} className="font-mono underline decoration-line-strong underline-offset-4 hover:text-fg">{r.src_ip}</Link>
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm text-muted">{r.notes}</p>
                {user?.role === "admin" ? (
                  <form action={deleteReport}>
                    <input type="hidden" name="id" value={r._id} />
                    <button type="submit" className="text-xs text-danger underline decoration-danger/40 underline-offset-4">Delete</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}