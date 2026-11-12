"use client";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const apiDown = /unreachable|empty answer|fetch failed|ECONNREFUSED/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">The dashboard could not load</h1>
      <p className="mt-2 text-sm text-muted">
        {apiDown
          ? "The API did not answer. Check that the API tunnel is still running, then try again."
          : "Something went wrong while loading this page. If the API tunnel was restarted, try again first."}
      </p>
      {!apiDown && error.digest && <p className="mt-2 font-mono text-xs text-faint">Error code {error.digest}</p>}
      <button onClick={reset} className="smooth mt-6 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-bg hover:bg-brand-strong">
        Try again
      </button>
    </div>
  );
}
