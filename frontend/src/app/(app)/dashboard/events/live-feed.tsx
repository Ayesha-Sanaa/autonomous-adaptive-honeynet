"use client";

import { useEffect, useState } from "react";

type LiveEvent = {
  _id: string;
  timestamp: string;
  decoy: string;
  event_type: string;
  src_ip?: string;
  command?: string;
  username?: string;
  attack?: { id: string; name: string }[];
};

type LiveDecision = {
  _id: string;
  timestamp: string;
  src_ip: string;
  session: string | null;
  action: string;
  fallback: boolean;
};

function hhmmss(ts: string) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "--:--:--" : d.toISOString().slice(11, 19);
}

export default function LiveFeed() {
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [decisions, setDecisions] = useState<LiveDecision[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "offline" : "connecting");
    es.addEventListener("event", (m) => {
      const e = JSON.parse((m as MessageEvent).data) as LiveEvent;
      setEvents((prev) => [e, ...prev.filter((x) => x._id !== e._id)].slice(0, 12));
    });
    es.addEventListener("decision", (m) => {
      const d = JSON.parse((m as MessageEvent).data) as LiveDecision;
      setDecisions((prev) => [d, ...prev.filter((x) => x._id !== d._id)].slice(0, 6));
    });
    return () => es.close();
  }, []);

  const dot =
    status === "live" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500" : "bg-red-500";

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">New activity (live)</h2>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          {status === "live" ? "Connected" : status === "connecting" ? "Connecting" : "Disconnected"}
        </span>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-2 text-xs text-faint">Events that arrived after you opened this page</div>
          {events.length === 0 ? (
            <p className="text-sm text-muted">Waiting for new events. Try connecting to a decoy.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {events.map((e) => (
                <li key={e._id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted">{hhmmss(e.timestamp)}</span>
                  <span>{e.decoy}</span>
                  <span>{e.event_type.replace(/_/g, " ")}</span>
                  <span>{e.src_ip ?? "unknown"}</span>
                  {e.command ? <span className="max-w-[320px] truncate">{e.command}</span> : null}
                  {e.attack && e.attack.length > 0 ? (
                    <span className="text-muted">{e.attack.map((t) => t.id).join(", ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 text-xs text-faint">New RL decisions</div>
          {decisions.length === 0 ? (
            <p className="text-sm text-muted">None yet. A decision appears when an SSH session ends.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {decisions.map((d) => (
                <li key={d._id}>
                  <span className="text-muted">{hhmmss(d.timestamp)}</span> {d.src_ip} → {d.action}
                  {d.fallback ? <span className="text-danger"> (fallback)</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}