export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse" aria-busy="true">
      <div className="mb-8 h-8 w-40 rounded-md bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 rounded-xl border border-line bg-surface" />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-xl border border-line bg-surface lg:col-span-2" />
        <div className="h-80 rounded-xl border border-line bg-surface" />
      </div>
    </div>
  );
}
