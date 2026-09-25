import { listFines, payFineAction, waiveFineAction } from "@/lib/actions/fines";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";

export default async function AdminFinesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; page?: string }>;
}) {
  const { status, error, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const { fines, total, pageSize } = await listFines({ status, page: currentPage });

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Fines ({total})</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <form className="flex gap-2" action="/admin/fines">
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {["PENDING", "PARTIALLY_PAID", "PAID", "WAIVED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Filter</button>
      </form>

      <DataTable
        rows={fines as any[]}
        emptyMessage="No fines recorded."
        columns={[
          { header: "Student", cell: (r: any) => r.studentId?.name },
          { header: "Amount", cell: (r: any) => `₹${r.amount}` },
          { header: "Reason", cell: (r: any) => r.reason },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "Actions",
            cell: (r: any) =>
              r.status === "PENDING" || r.status === "PARTIALLY_PAID" ? (
                <div className="flex gap-2">
                  <form action={payFineAction} className="flex items-center gap-1">
                    <input type="hidden" name="fineId" value={r.fineId} />
                    <input name="amount" type="number" step="0.01" placeholder="₹" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs" />
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Pay</button>
                  </form>
                  <form action={waiveFineAction}>
                    <input type="hidden" name="fineId" value={r.fineId} />
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Waive</button>
                  </form>
                </div>
              ) : (
                "—"
              ),
          },
        ]}
      />

      <Pagination page={currentPage} pageSize={pageSize} total={total} basePath="/admin/fines" extraParams={{ status }} />
    </div>
  );
}
