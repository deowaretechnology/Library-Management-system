import { getSession } from "@/lib/auth/session";
import { getStudentDetail } from "@/lib/actions/students";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatIstDate } from "@/lib/domain/dates";

export default async function StudentHistoryPage() {
  const session = await getSession();
  const detail = await getStudentDetail(session!.studentId!);
  if (!detail) return <div className="p-6 text-sm text-slate-500">Profile not found.</div>;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Borrowing History</h1>
      <DataTable
        rows={detail.allBorrows as any[]}
        emptyMessage="No borrowing history yet."
        columns={[
          { header: "Sanity Book ID", cell: (r: any) => r.sanityBookId },
          { header: "Issue date", cell: (r: any) => formatIstDate(r.issueDate) },
          { header: "Due date", cell: (r: any) => formatIstDate(r.dueDate) },
          { header: "Return date", cell: (r: any) => (r.returnDate ? formatIstDate(r.returnDate) : "—") },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
