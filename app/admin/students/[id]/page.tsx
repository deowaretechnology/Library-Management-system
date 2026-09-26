import Link from "next/link";
import { getStudentDetail, updateStudentStatusAction, getClearanceStatus, confirmClearanceAction } from "@/lib/actions/students";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StudentQRCode } from "@/components/StudentQRCode";
import { formatIstDate } from "@/lib/domain/dates";

export default async function AdminStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; cleared?: string }>;
}) {
  const { id } = await params;
  const { error, cleared } = await searchParams;
  const detail = await getStudentDetail(id);

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Student not found.</p>
        <Link href="/admin/students" className="text-sm text-brand-600 hover:underline">← Back to Students</Link>
      </div>
    );
  }

  const { student, activeBorrows, allBorrows, fines } = detail as any;
  const clearance = await getClearanceStatus(id);

  return (
    <div className="space-y-6 p-6">
      <Link href="/admin/students" className="text-sm text-brand-600 hover:underline">← Back to Students</Link>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{student.name}</h1>
          <p className="text-sm text-slate-500">
            {student.studentId} · {student.libraryId} · {student.department} · Sem {student.semester}
          </p>
          <p className="text-sm text-slate-500">{student.email} · {student.phone}</p>
          <form action={updateStudentStatusAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="studentId" value={student.studentId} />
            <select name="status" defaultValue={student.status} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED", "BLOCKED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Update</button>
          </form>
        </div>

        <StudentQRCode studentId={student.studentId} studentName={student.name} size={140} />
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}
      {cleared && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Clearance confirmed.</p>}

      <div className={`flex items-center justify-between rounded-xl border p-4 ${clearance.cleared ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div>
          <p className={`text-sm font-medium ${clearance.cleared ? "text-emerald-900" : "text-amber-900"}`}>
            {clearance.cleared ? "Eligible for clearance" : "Clearance pending"}
          </p>
          {!clearance.cleared && (
            <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
              {clearance.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          {student.clearanceConfirmedAt && (
            <p className="mt-1 text-xs text-emerald-700">
              Confirmed {formatIstDate(student.clearanceConfirmedAt)}
            </p>
          )}
        </div>
        {clearance.cleared && !student.clearanceConfirmedAt && (
          <form action={confirmClearanceAction}>
            <input type="hidden" name="studentId" value={student.studentId} />
            <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              Confirm Clearance
            </button>
          </form>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Currently Borrowed ({activeBorrows.length})</h2>
        <DataTable
          rows={activeBorrows}
          emptyMessage="Nothing checked out."
          columns={[
            { header: "Sanity Book ID", cell: (r: any) => r.sanityBookId },
            { header: "Due", cell: (r: any) => formatIstDate(r.dueDate) },
            { header: "Status", cell: (r: any) => <StatusBadge status={new Date(r.dueDate) < new Date() ? "OVERDUE" : "ACTIVE"} /> },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Borrowing History</h2>
        <DataTable
          rows={allBorrows}
          emptyMessage="No history yet."
          columns={[
            { header: "Sanity Book ID", cell: (r: any) => r.sanityBookId },
            { header: "Issued", cell: (r: any) => formatIstDate(r.issueDate) },
            { header: "Returned", cell: (r: any) => (r.returnDate ? formatIstDate(r.returnDate) : "—") },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Fines</h2>
        <DataTable
          rows={fines}
          emptyMessage="No fines."
          columns={[
            { header: "Amount", cell: (r: any) => `₹${r.amount}` },
            { header: "Reason", cell: (r: any) => r.reason },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>
    </div>
  );
}
