"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">The dashboard could not load</h1>
      <p className="mt-2 text-sm text-muted">The API did not answer. Check that the API tunnel is still running, then try again.</p>
      <button onClick={reset} className="smooth mt-6 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-bg hover:bg-brand-strong">
        Try again
      </button>
    </div>
  );
}
