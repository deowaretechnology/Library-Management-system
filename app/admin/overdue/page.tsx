import { getOverdueTransactions } from "@/lib/actions/dashboard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatIstDate } from "@/lib/domain/dates";

export default async function AdminOverduePage() {
  const overdue = await getOverdueTransactions();
  const dayCount = (due: string) => Math.ceil((Date.now() - new Date(due).getTime()) / 86400000);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Overdue Books ({overdue.length})</h1>
        <div className="flex gap-3 text-sm">
          <a href="/admin/reports/export?type=overdue&format=csv" className="text-brand-600 hover:underline">CSV</a>
          <a href="/admin/reports/export?type=overdue&format=pdf" className="text-brand-600 hover:underline">PDF</a>
        </div>
      </div>
      <DataTable
        rows={overdue as any[]}
        emptyMessage="Nothing overdue — nice."
        columns={[
          { header: "Student", cell: (r: any) => r.studentId?.name },
          { header: "Phone", cell: (r: any) => r.studentId?.phone },
          { header: "Due date", cell: (r: any) => formatIstDate(r.dueDate) },
          { header: "Days overdue", cell: (r: any) => dayCount(r.dueDate) },
          { header: "Status", cell: () => <StatusBadge status="OVERDUE" /> },
        ]}
      />
    </div>
  );
}
