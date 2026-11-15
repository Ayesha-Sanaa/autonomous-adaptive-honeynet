import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-2xl font-semibold">This page is not here</h1>
      <p className="text-sm text-muted">
        The address may be mistyped, or the page was moved. Nothing in the honeynet was touched.
      </p>
      <Link href="/dashboard" className="rounded border border-line-strong px-4 py-2 text-sm hover:bg-surface-2">
        Back to the dashboard
      </Link>
    </main>
  );
}