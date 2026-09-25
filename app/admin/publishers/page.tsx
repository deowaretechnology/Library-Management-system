import { listPublishers } from "@/lib/actions/catalog";
import { CreatePublisherForm } from "@/components/forms/CreatePublisherForm";
import { DataTable } from "@/components/DataTable";

export default async function AdminPublishersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;
  const publishers = await listPublishers();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Publishers ({publishers.length})</h1>

      <details className="rounded-xl border border-slate-200 bg-white p-4" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a publisher</summary>
        {created && <p className="mt-3 text-sm text-emerald-600">Publisher added and published.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreatePublisherForm />
      </details>

      <DataTable
        rows={publishers as any[]}
        emptyMessage="No publishers yet — add one above."
        columns={[
          {
            header: "Logo",
            cell: (r: any) =>
              r.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.logoUrl} alt={r.name} className="h-8 w-8 rounded object-contain" />
              ) : (
                <span className="text-slate-300">—</span>
              ),
          },
          { header: "Name", cell: (r: any) => r.name },
          { header: "Address", cell: (r: any) => r.address ?? "—" },
          { header: "Books", cell: (r: any) => r.bookCount },
        ]}
      />
    </div>
  );
}
