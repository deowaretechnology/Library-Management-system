import { listCurrentlyInside, listRecentVisits } from "@/lib/actions/visits";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EntryExitScanForm } from "@/components/forms/EntryExitScanForm";
import { formatIstDate } from "@/lib/domain/dates";

export default async function AdminEntryExitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [inside, recent] = await Promise.all([listCurrentlyInside(), listRecentVisits()]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Entry / Exit</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <EntryExitScanForm />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Currently Inside ({inside.length})</h2>
        <DataTable
          rows={inside as any[]}
          emptyMessage="Nobody inside right now."
          columns={[
            { header: "Student", cell: (r: any) => r.studentId?.name },
            { header: "Student ID", cell: (r: any) => r.studentId?.studentId },
            { header: "Entry time", cell: (r: any) => r.entryTime },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent Visits</h2>
        <DataTable
          rows={recent as any[]}
          emptyMessage="No visits yet."
          columns={[
            { header: "Student", cell: (r: any) => r.studentId?.name },
            { header: "Entry", cell: (r: any) => `${formatIstDate(r.entryDate)} ${r.entryTime}` },
            { header: "Exit", cell: (r: any) => (r.exitTime ? r.exitTime : "—") },
            { header: "Duration (min)", cell: (r: any) => r.durationMinutes ?? "—" },
            { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </section>
    </div>
  );
}
