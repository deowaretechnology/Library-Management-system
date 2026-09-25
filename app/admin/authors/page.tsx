import { listAuthors } from "@/lib/actions/catalog";
import { CreateAuthorForm } from "@/components/forms/CreateAuthorForm";
import { DataTable } from "@/components/DataTable";

export default async function AdminAuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;
  const authors = await listAuthors();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Authors ({authors.length})</h1>

      <details className="rounded-xl border border-slate-200 bg-white p-4" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add an author</summary>
        {created && <p className="mt-3 text-sm text-emerald-600">Author added and published.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateAuthorForm />
      </details>

      <DataTable
        rows={authors as any[]}
        emptyMessage="No authors yet — add one above."
        columns={[
          {
            header: "Photo",
            cell: (r: any) =>
              r.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photoUrl} alt={r.name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="text-slate-300">—</span>
              ),
          },
          { header: "Name", cell: (r: any) => r.name },
          { header: "Bio", cell: (r: any) => r.bio ?? "—" },
          { header: "Books", cell: (r: any) => r.bookCount },
        ]}
      />
    </div>
  );
}
