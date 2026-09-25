import { searchCatalog } from "@/lib/actions/catalog";
import { reserveBookAction } from "@/lib/actions/reservations";
import { getSession } from "@/lib/auth/session";
import { DataTable } from "@/components/DataTable";

export default async function StudentBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  const { q, error, success } = await searchParams;
  const session = await getSession();
  const { books, total } = await searchCatalog(q ?? "");

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Search Books ({total})</h1>
      {success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Reservation requested — you'll be notified when a copy is ready.</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <form className="flex gap-2" action="/student/books">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, ISBN, or author"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Search</button>
      </form>

      <DataTable
        rows={books as any[]}
        emptyMessage="No books found."
        columns={[
          { header: "Title", cell: (r: any) => r.title },
          { header: "Authors", cell: (r: any) => (r.authors ?? []).join(", ") || "—" },
          { header: "Category", cell: (r: any) => r.category ?? "—" },
          {
            header: "Availability",
            cell: (r: any) =>
              r.availability.available > 0
                ? `${r.availability.available} available`
                : "Not available",
          },
          {
            header: "",
            cell: (r: any) =>
              r.availability.available === 0 ? (
                <form action={reserveBookAction}>
                  <input type="hidden" name="studentId" value={session?.studentId} />
                  <input type="hidden" name="sanityBookId" value={r._id} />
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Reserve</button>
                </form>
              ) : null,
          },
        ]}
      />
    </div>
  );
}

