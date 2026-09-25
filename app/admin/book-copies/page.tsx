import Link from "next/link";
import { listBookCopies } from "@/lib/actions/bookCopies";
import { listBookOptions } from "@/lib/actions/catalog";
import { CreateBookCopyForm } from "@/components/forms/CreateBookCopyForm";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";

function formatDate(d?: string | Date) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminBookCopiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; page?: string; created?: string }>;
}) {
  const { q, status, error, page, created } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const [{ copies, total, pageSize }, books] = await Promise.all([
    listBookCopies({ query: q, status, page: currentPage }),
    listBookOptions(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Book Copies ({total})</h1>

      {created && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="text-sm font-medium text-emerald-900">Copy added.</p>
            <p className="mt-1 text-xs text-emerald-700">
              Stick your printed QR (the one with this number on it) onto the book — this is the number the counter
              will match when scanning to issue or return it.
            </p>
          </div>
          <span className="rounded-lg border border-emerald-300 bg-white px-4 py-2 font-mono text-lg font-semibold text-emerald-900">
            {created}
          </span>
        </div>
      )}

      <form className="flex flex-wrap gap-2" action="/admin/book-copies">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by copy ID, barcode, or accession no."
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {["AVAILABLE", "ISSUED", "RESERVED", "LOST", "DAMAGED", "REPAIR", "ARCHIVED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Filter</button>
      </form>

      <details className="rounded-xl border border-slate-200 bg-white p-4" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a physical copy</summary>
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateBookCopyForm books={books as any[]} />
      </details>

      <DataTable
        rows={copies as any[]}
        emptyMessage="No copies yet — add one above."
        columns={[
          { header: "Copy ID", cell: (r: any) => r.copyId },
          { header: "Barcode / QR No.", cell: (r: any) => <span className="font-mono">{r.barcode}</span> },
          { header: "Sanity Book ID", cell: (r: any) => r.sanityBookId },
          { header: "Location", cell: (r: any) => [r.location?.rackId, r.location?.shelfId].filter(Boolean).join(" / ") || "—" },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "Issued To",
            cell: (r: any) =>
              r.issuedTo ? (
                <Link href={`/admin/students/${r.issuedTo.studentDbId}`} className="text-brand-600 hover:underline">
                  {r.issuedTo.studentName}{" "}
                  <span className="text-slate-400">
                    ({r.issuedTo.libraryId}) · due {formatDate(r.issuedTo.dueDate)}
                  </span>
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              ),
          },
        ]}
      />

      <Pagination page={currentPage} pageSize={pageSize} total={total} basePath="/admin/book-copies" extraParams={{ q, status }} />
    </div>
  );
}
