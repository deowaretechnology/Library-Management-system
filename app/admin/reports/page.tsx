import {
  getMostBorrowedBooks,
  getDepartmentWiseBorrowing,
  getFineCollectionSummary,
  getStudentReport,
  getInventoryReport,
  getClearanceReport,
  getIssueReport,
  getReturnReport,
  getLostDamagedReport,
  getEntryExitReport,
  getMostActiveStudents,
  getAnnualStats,
} from "@/lib/actions/reports";
import { runDueSoonSweepAction } from "@/lib/actions/notifications";
import { DataTable } from "@/components/DataTable";
import { TrendChart } from "@/components/TrendChart";
import { StatusBadge } from "@/components/StatusBadge";

function ExportLinks({ type }: { type: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <a href={`/admin/reports/export?type=${type}&format=csv`} className="text-brand-600 hover:underline">CSV</a>
      <a href={`/admin/reports/export?type=${type}&format=pdf`} className="text-brand-600 hover:underline">PDF</a>
    </div>
  );
}

function SectionHeader({ title, type, count }: { title: string; type: string; count?: number }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-700">{title}{count !== undefined && ` (${count})`}</h2>
      <ExportLinks type={type} />
    </div>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ swept?: string; checked?: string }>;
}) {
  const { swept, checked } = await searchParams;
  const [
    mostBorrowed, byDepartment, fineSummary, studentReport, inventory, clearance,
    issues, returns, lostDamaged, entryExit, mostActive, annual,
  ] = await Promise.all([
    getMostBorrowedBooks(),
    getDepartmentWiseBorrowing(),
    getFineCollectionSummary(),
    getStudentReport(),
    getInventoryReport(),
    getClearanceReport(),
    getIssueReport(),
    getReturnReport(),
    getLostDamagedReport(),
    getEntryExitReport(),
    getMostActiveStudents(),
    getAnnualStats(),
  ]);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Library Reports</h1>
          <p className="text-sm text-slate-500">Live aggregations from MongoDB — all 14 of the spec's report types, CSV + PDF export on each.</p>
        </div>
        <form action={runDueSoonSweepAction}>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            Send due-soon / overdue alerts
          </button>
        </form>
      </div>
      {swept !== undefined && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Checked {checked} active loans, sent {swept} new notifications.
        </p>
      )}

      <section>
        <SectionHeader title={`Annual Statistics (${annual.year})`} type="issues" />
        <div className="mb-3 flex gap-6 text-sm text-slate-600">
          <span>Total issues: <strong>{annual.totalIssues}</strong></span>
          <span>Total returns: <strong>{annual.totalReturns}</strong></span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <TrendChart data={annual.monthly} dataKey="issues" xKey="month" />
        </div>
      </section>

      <section>
        <SectionHeader title="Student Report" type="students" count={studentReport.length} />
        <DataTable
          rows={studentReport as any[]}
          emptyMessage="No students yet."
          columns={[
            { header: "Name", cell: (r: any) => r.name },
            { header: "Department", cell: (r: any) => r.department },
            { header: "Active Borrows", cell: (r: any) => r.activeBorrowCount },
            { header: "Pending Fine", cell: (r: any) => `₹${r.pendingFineTotal}` },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Inventory Report" type="inventory" />
        <DataTable
          rows={(inventory as any[]).map((r) => ({ status: r._id, count: r.count }))}
          emptyMessage="No copies yet."
          columns={[
            { header: "Status", cell: (r: any) => r.status },
            { header: "Count", cell: (r: any) => r.count },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Issue Report" type="issues" count={issues.length} />
        <p className="mb-2 text-xs text-slate-500">Last 30 days.</p>
        <DataTable
          rows={(issues as any[]).map((t) => ({ ...t, student: t.studentId?.name }))}
          emptyMessage="No issues in the last 30 days."
          columns={[
            { header: "Student", cell: (r: any) => r.student },
            { header: "Issued", cell: (r: any) => new Date(r.issueDate).toLocaleDateString() },
            { header: "Due", cell: (r: any) => new Date(r.dueDate).toLocaleDateString() },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Return Report" type="returns" count={returns.length} />
        <p className="mb-2 text-xs text-slate-500">Last 30 days.</p>
        <DataTable
          rows={(returns as any[]).map((t) => ({ ...t, student: t.studentId?.name }))}
          emptyMessage="No returns in the last 30 days."
          columns={[
            { header: "Student", cell: (r: any) => r.student },
            { header: "Returned", cell: (r: any) => r.returnDate ? new Date(r.returnDate).toLocaleDateString() : "—" },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Lost / Damaged Report" type="lost-damaged" count={lostDamaged.length} />
        <DataTable
          rows={lostDamaged as any[]}
          emptyMessage="None."
          columns={[
            { header: "Copy ID", cell: (r: any) => r.copyId },
            { header: "Barcode", cell: (r: any) => r.barcode },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
            { header: "Notes", cell: (r: any) => r.notes || "—" },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Entry / Exit Report" type="entry-exit" count={entryExit.length} />
        <p className="mb-2 text-xs text-slate-500">Last 30 days.</p>
        <DataTable
          rows={(entryExit as any[]).map((v) => ({ ...v, student: v.studentId?.name }))}
          emptyMessage="No visits in the last 30 days."
          columns={[
            { header: "Student", cell: (r: any) => r.student },
            { header: "Entry", cell: (r: any) => `${new Date(r.entryDate).toLocaleDateString()} ${r.entryTime}` },
            { header: "Exit", cell: (r: any) => r.exitTime ?? "—" },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Most Active Students" type="most-active" />
        <DataTable
          rows={(mostActive as any[]).map((r) => ({ ...r, name: r.student?.name, studentId: r.student?.studentId }))}
          emptyMessage="No activity yet."
          columns={[
            { header: "Name", cell: (r: any) => r.name },
            { header: "Borrows", cell: (r: any) => r.borrows },
            { header: "Visits", cell: (r: any) => r.visits },
            { header: "Total Activity", cell: (r: any) => r.total },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Clearance Report" type="clearance" count={clearance.length} />
        <DataTable
          rows={clearance as any[]}
          emptyMessage="No students yet."
          columns={[
            { header: "Name", cell: (r: any) => r.name },
            { header: "Department", cell: (r: any) => r.department },
            { header: "Eligible", cell: (r: any) => (r.eligible ? "Yes" : "No") },
            { header: "Confirmed", cell: (r: any) => (r.confirmed ? "Yes" : "No") },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Most Borrowed Books" type="most-borrowed" />
        <DataTable
          rows={mostBorrowed as any[]}
          emptyMessage="No borrowing activity yet."
          columns={[
            { header: "Sanity Book ID", cell: (r: any) => r._id },
            { header: "Times Borrowed", cell: (r: any) => r.borrowCount },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Department-wise Borrowing</h2>
        <DataTable
          rows={byDepartment as any[]}
          emptyMessage="No data yet."
          columns={[
            { header: "Department", cell: (r: any) => r._id },
            { header: "Books Borrowed", cell: (r: any) => r.count },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Fine Collection Summary" type="fines" />
        <DataTable
          rows={fineSummary as any[]}
          emptyMessage="No fines recorded."
          columns={[
            { header: "Status", cell: (r: any) => r._id },
            { header: "Count", cell: (r: any) => r.count },
            { header: "Total (₹)", cell: (r: any) => r.total },
          ]}
        />
      </section>
    </div>
  );
}
