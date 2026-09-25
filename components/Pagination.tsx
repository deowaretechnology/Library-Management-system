import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  extraParams = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`rounded-md border border-slate-300 px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}
        >
          Previous
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`rounded-md border border-slate-300 px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
