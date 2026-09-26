import { getDueSoonTransactions } from "@/lib/actions/dashboard";
import { renewBookFormAction } from "@/lib/actions/transactions";
import { DataTable } from "@/components/DataTable";
import { formatIstDate } from "@/lib/domain/dates";

export default async function AdminRenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const dueSoon = await getDueSoonTransactions();

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Renewals — due within 3 days</h1>
      {success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Renewed successfully.</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <DataTable
        rows={dueSoon as any[]}
        emptyMessage="Nothing due soon."
        columns={[
          { header: "Student", cell: (r: any) => `${r.studentId?.name} (${r.studentId?.studentId})` },
          { header: "Due", cell: (r: any) => formatIstDate(r.dueDate) },
          { header: "Renewals used", cell: (r: any) => r.renewalCount },
          {
            header: "",
            cell: (r: any) => (
              <form action={renewBookFormAction}>
                <input type="hidden" name="transactionId" value={r.transactionId} />
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Renew</button>
              </form>
            ),
          },
        ]}
      />
    </div>
  );
}
