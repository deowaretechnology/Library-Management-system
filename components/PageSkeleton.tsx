/**
 * Generic loading skeleton shown automatically by Next.js while a route's
 * server component is still fetching (MongoDB/Sanity) — used by
 * app/admin/loading.tsx and app/student/loading.tsx.
 *
 * Without this, App Router shows nothing at all during that fetch (the old
 * page just sits there, unresponsive, until the new one is fully ready),
 * which is what made navigation feel slow/janky even when the actual query
 * was fast. This gives instant visual feedback the moment a link is tapped.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-6 w-40 rounded bg-slate-200" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-12 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 p-3">
          <div className="h-3 w-24 rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="h-3 flex-1 rounded bg-slate-200" />
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="h-3 w-20 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
