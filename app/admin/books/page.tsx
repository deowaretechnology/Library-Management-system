import { searchCatalog, getCatalogOptions } from "@/lib/actions/catalog";
import { CreateBookForm } from "@/components/forms/CreateBookForm";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; created?: string }>;
}) {
  const { q, error, created } = await searchParams;
  const [{ books, total }, options] = await Promise.all([searchCatalog(q ?? ""), getCatalogOptions()]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Books ({total})</h1>
        <a
          href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/studio/structure/book`}
          target="_blank"
          className="text-sm text-brand-600 hover:underline"
        >
          Open in Sanity Studio →
        </a>
      </div>

      <form className="flex gap-2" action="/admin/books">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, ISBN, or author"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Search</button>
      </form>

      <details className="rounded-xl border border-slate-200 bg-white p-4" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a book</summary>
        {created && <p className="mt-3 text-sm text-emerald-600">Book added and published to the catalog.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateBookForm
          authors={options.authors}
          publishers={options.publishers}
          categories={options.categories}
          subjects={options.subjects}
        />
      </details>

      <DataTable
        rows={books as any[]}
        emptyMessage="No books in the catalog yet — add some in Sanity Studio."
        columns={[
          { header: "Title", cell: (r: any) => <Link href={`/admin/books/${r._id}`} className="text-brand-600 hover:underline">{r.title}</Link> },
          { header: "ISBN", cell: (r: any) => r.isbn },
          { header: "Authors", cell: (r: any) => (r.authors ?? []).join(", ") || "—" },
          { header: "Category", cell: (r: any) => r.category ?? "—" },
          { header: "Copies", cell: (r: any) => `${r.availability.available} available / ${r.availability.total} total` },
        ]}
      />
    </div>
  );
}
