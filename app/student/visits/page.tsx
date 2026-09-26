import { getSession } from "@/lib/auth/session";
import { getStudentDetail } from "@/lib/actions/students";
import { listVisitsForStudent } from "@/lib/actions/visits";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatIstDate } from "@/lib/domain/dates";

export default async function StudentVisitsPage() {
  const session = await getSession();
  const detail = await getStudentDetail(session!.studentId!);
  if (!detail) return <div className="p-6 text-sm text-slate-500">Profile not found.</div>;

  const visits = await listVisitsForStudent((detail.student as any)._id.toString());

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Library Visit History</h1>
      <DataTable
        rows={visits as any[]}
        emptyMessage="No library visits recorded yet."
        columns={[
          { header: "Date", cell: (r: any) => formatIstDate(r.entryDate) },
          { header: "Entry", cell: (r: any) => r.entryTime },
          { header: "Exit", cell: (r: any) => r.exitTime ?? "—" },
          { header: "Duration (min)", cell: (r: any) => r.durationMinutes ?? "—" },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
