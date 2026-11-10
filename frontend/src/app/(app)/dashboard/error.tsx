"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-xl font-semibold">The dashboard could not load its data</h1>
      <p className="mt-2 text-sm text-muted">The honeynet API is not answering. It may be restarting, so try again in a few seconds.</p>
      <button onClick={reset} className="mt-6 h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-bg transition hover:bg-brand-strong">
        Try again
      </button>
    </div>
  );
}
