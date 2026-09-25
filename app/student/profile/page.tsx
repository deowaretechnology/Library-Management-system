import { getSession } from "@/lib/auth/session";
import { getStudentDetail } from "@/lib/actions/students";
import { StatusBadge } from "@/components/StatusBadge";
import { StudentQRCode } from "@/components/StudentQRCode";

export default async function StudentProfilePage() {
  const session = await getSession();
  const detail = await getStudentDetail(session!.studentId!);
  if (!detail) return <div className="p-6 text-sm text-slate-500">Profile not found.</div>;
  const s = detail.student as any;

  const rows: [string, string][] = [
    ["Name", s.name],
    ["Student ID", s.studentId],
    ["Library ID", s.libraryId],
    ["Enrollment No.", s.enrollmentNo],
    ["Department", s.department],
    ["Course", s.course],
    ["Semester", String(s.semester)],
    ["Academic Year", s.academicYear],
    ["Email", s.email],
    ["Phone", s.phone],
  ];

  return (
    <div className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Profile</h1>

      <div className="flex flex-col items-center gap-2 rounded-xl border border-brass-300/60 bg-brass-300/10 p-4 text-center">
        <p className="text-sm font-medium text-ink-950">Your Library QR</p>
        <p className="text-xs text-slate-500">Show this at the counter — it can be scanned to issue books or log your entry/exit.</p>
        <StudentQRCode studentId={s.studentId} studentName={s.name} size={160} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <dl className="divide-y divide-slate-100 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-900">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between py-2">
            <dt className="text-slate-500">Account status</dt>
            <dd><StatusBadge status={s.status} /></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
