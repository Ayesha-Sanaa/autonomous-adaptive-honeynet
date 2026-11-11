"use client";

import { useTransition } from "react";
import { toggleDemoMode } from "@/app/actions";

export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`mb-6 flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${isDemo ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-surface text-muted"}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${isDemo ? "bg-brand animate-pulse" : "bg-ok"}`} />
        <span>
          <strong className="font-semibold text-fg">{isDemo ? "Demo Mode Active:" : "Live Telemetry:"}</strong>{" "}
          {isDemo ? "Showing synthetic honeynet attack data." : "Showing real live events."}
        </span>
      </div>
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await toggleDemoMode(!isDemo);
          });
        }}
        className="rounded border border-line-strong bg-surface-2 px-3 py-1 text-xs font-medium text-fg hover:bg-line transition disabled:opacity-50"
      >
        {isPending ? "Switching..." : isDemo ? "Switch to Real Data" : "Switch to Demo Data"}
      </button>
    </div>
  );
}
