import Link from "next/link";
import { getBookDetail } from "@/lib/actions/catalog";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

export default async function AdminBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getBookDetail(id);

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Book not found in the catalog.</p>
        <Link href="/admin/books" className="text-sm text-brand-600 hover:underline">← Back to Books</Link>
      </div>
    );
  }

  const { book, copies } = detail as any;
  const available = copies.filter((c: any) => c.status === "AVAILABLE").length;

  return (
    <div className="space-y-6 p-6">
      <Link href="/admin/books" className="text-sm text-brand-600 hover:underline">← Back to Books</Link>

      <div className="flex gap-6">
        {book.coverUrl && (
          <img src={book.coverUrl} alt={book.title} className="h-40 w-28 rounded-md object-cover shadow-sm" />
        )}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{book.title}</h1>
          {book.subtitle && <p className="text-sm text-slate-500">{book.subtitle}</p>}
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><dt className="inline text-slate-500">ISBN: </dt><dd className="inline">{book.isbn}</dd></div>
            <div><dt className="inline text-slate-500">Edition: </dt><dd className="inline">{book.edition ?? "—"}</dd></div>
            <div><dt className="inline text-slate-500">Year: </dt><dd className="inline">{book.publicationYear ?? "—"}</dd></div>
            <div><dt className="inline text-slate-500">Language: </dt><dd className="inline">{book.language ?? "—"}</dd></div>
            <div><dt className="inline text-slate-500">Authors: </dt><dd className="inline">{(book.authors ?? []).map((a: any) => a.name).join(", ") || "—"}</dd></div>
            <div><dt className="inline text-slate-500">Publisher: </dt><dd className="inline">{book.publisher?.name ?? "—"}</dd></div>
            <div><dt className="inline text-slate-500">Category: </dt><dd className="inline">{book.category?.name ?? "—"}</dd></div>
            <div><dt className="inline text-slate-500">Copies: </dt><dd className="inline">{available} available / {copies.length} total</dd></div>
          </dl>
          {book.description && <p className="mt-3 max-w-2xl text-sm text-slate-600">{book.description}</p>}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Physical Copies</h2>
        <DataTable
          rows={copies}
          emptyMessage="No physical copies yet — add one from Book Copies."
          columns={[
            { header: "Copy ID", cell: (r: any) => r.copyId },
            { header: "Barcode", cell: (r: any) => r.barcode },
            { header: "Location", cell: (r: any) => [r.location?.rackId, r.location?.shelfId].filter(Boolean).join(" / ") || "—" },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>
    </div>
  );
}
