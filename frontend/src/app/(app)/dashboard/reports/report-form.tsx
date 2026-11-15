"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createReport, type ReportState } from "./actions";

const initial: ReportState = { error: null, done: false };
const field = "smooth w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="smooth h-10 rounded-md bg-brand px-4 text-sm font-semibold text-bg hover:bg-brand-strong disabled:opacity-70">
      {pending ? "Saving" : "Save report"}
    </button>
  );
}

export function ReportForm({ defaultIp = "" }: { defaultIp?: string }) {
  const [state, action] = useActionState(createReport, initial);
  return (
    <form key={state.done ? "done" : "open"} action={action} className="space-y-4" noValidate>
      {state.error && (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">{state.error}</div>
      )}
      {state.done && (
        <div role="status" className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2.5 text-sm text-ok">Report saved.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">Title</label>
          <input id="title" name="title" maxLength={120} required className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="severity" className="text-sm font-medium">Severity</label>
          <select id="severity" name="severity" defaultValue="medium" className={field}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="src_ip" className="text-sm font-medium">Attacker IP (optional)</label>
        <input id="src_ip" name="src_ip" defaultValue={defaultIp} maxLength={64} className={`${field} font-mono`} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">What happened and what to do next</label>
        <textarea id="notes" name="notes" rows={5} maxLength={4000} required className={field} />
      </div>
      <Save />
    </form>
  );
}