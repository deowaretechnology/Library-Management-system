import { getSession } from "@/lib/auth/session";
import { getStudentDetail } from "@/lib/actions/students";
import { StatCard } from "@/components/StatCard";
import { BookMarked, AlertTriangle, Banknote, History } from "lucide-react";

export default async function StudentDashboardPage() {
  const session = await getSession();
  const detail = await getStudentDetail(session!.studentId!);
  if (!detail) return <div className="p-6 text-sm text-slate-500">Profile not found.</div>;

  const { student, activeBorrows, allBorrows, fines } = detail;
  const overdue = activeBorrows.filter((b: any) => new Date(b.dueDate) < new Date());
  const pendingFineTotal = fines
    .filter((f: any) => f.status === "PENDING" || f.status === "PARTIALLY_PAID")
    .reduce((sum: number, f: any) => sum + f.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">
        Welcome, {(student as any).name}
      </h1>
      <p className="text-sm text-slate-500">
        {(student as any).studentId} · {(student as any).department}
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Currently Borrowed" value={activeBorrows.length} icon={BookMarked} />
        <StatCard label="Overdue" value={overdue.length} icon={AlertTriangle} tone={overdue.length > 0 ? "danger" : "default"} />
        <StatCard label="Pending Fine" value={`₹${pendingFineTotal}`} icon={Banknote} tone={pendingFineTotal > 0 ? "warning" : "default"} />
        <StatCard label="Total Borrowed (all time)" value={allBorrows.length} icon={History} />
      </div>
    </div>
  );
}
