// Skeleton shaped like the Overview, shown while the data loads.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-busy="true">
      <div className="h-12 w-64 animate-pulse rounded-md bg-surface" />
      <div className="h-24 animate-pulse rounded-lg bg-surface" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="h-64 animate-pulse rounded-lg bg-surface" />
          <div className="h-80 animate-pulse rounded-lg bg-surface" />
        </div>
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-lg bg-surface" />
          <div className="h-48 animate-pulse rounded-lg bg-surface" />
        </div>
      </div>
    </div>
  );
}
