import { listBookCopies } from "@/lib/actions/bookCopies";
import { MarkLostDamagedForm } from "@/components/forms/MarkLostDamagedForm";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

export default async function AdminLostDamagedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [lost, damaged] = await Promise.all([
    listBookCopies({ status: "LOST" }),
    listBookCopies({ status: "DAMAGED" }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Lost / Damaged</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <MarkLostDamagedForm />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Lost ({lost.total})</h2>
        <DataTable
          rows={lost.copies as any[]}
          emptyMessage="None."
          columns={[
            { header: "Copy ID", cell: (r: any) => r.copyId },
            { header: "Barcode", cell: (r: any) => r.barcode },
            { header: "Notes", cell: (r: any) => r.notes || "—" },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Damaged ({damaged.total})</h2>
        <DataTable
          rows={damaged.copies as any[]}
          emptyMessage="None."
          columns={[
            { header: "Copy ID", cell: (r: any) => r.copyId },
            { header: "Barcode", cell: (r: any) => r.barcode },
            { header: "Notes", cell: (r: any) => r.notes || "—" },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>
    </div>
  );
}
