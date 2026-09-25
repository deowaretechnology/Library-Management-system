import { Users, BookCopy, CheckCircle2, ArrowRightLeft, AlertTriangle, Banknote, PackageX, DoorOpen } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { TrendChart } from "@/components/TrendChart";
import { getDashboardStats, getRecentActivity, getIssuesTrend } from "@/lib/actions/dashboard";

export default async function AdminDashboardPage() {
  const [stats, activity, trend] = await Promise.all([getDashboardStats(), getRecentActivity(), getIssuesTrend()]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Students" value={stats.totalStudents} icon={Users} />
        <StatCard label="Total Book Copies" value={stats.totalCopies} icon={BookCopy} />
        <StatCard label="Available" value={stats.availableCopies} icon={CheckCircle2} tone="success" />
        <StatCard label="Issued" value={stats.issuedCopies} icon={ArrowRightLeft} />
        <StatCard label="Overdue" value={stats.overdueCount} icon={AlertTriangle} tone={stats.overdueCount > 0 ? "danger" : "default"} />
        <StatCard label="Pending Fines" value={`₹${stats.pendingFineTotal}`} icon={Banknote} tone={stats.pendingFineTotal > 0 ? "warning" : "default"} />
        <StatCard label="Lost / Damaged" value={stats.lostDamagedCount} icon={PackageX} />
        <StatCard label="Currently Inside" value={stats.currentlyInside} icon={DoorOpen} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Issues — last 7 days</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <TrendChart data={trend} dataKey="issues" xKey="day" />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent Issues</h2>
          <DataTable
            rows={activity.recentIssues}
            emptyMessage="No issues yet."
            columns={[
              { header: "Student", cell: (r: any) => r.studentId?.name ?? "—" },
              { header: "Copy", cell: (r: any) => r.bookCopyId?.toString().slice(-6) },
              { header: "Due", cell: (r: any) => new Date(r.dueDate).toLocaleDateString() },
              { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
            ]}
          />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent Returns</h2>
          <DataTable
            rows={activity.recentReturns}
            emptyMessage="No returns yet."
            columns={[
              { header: "Student", cell: (r: any) => r.studentId?.name ?? "—" },
              { header: "Returned", cell: (r: any) => r.returnDate ? new Date(r.returnDate).toLocaleDateString() : "—" },
              { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
