import { getSession } from "@/lib/auth/session";
import { listOwnFines } from "@/lib/actions/fines";
import { initiateFinePaymentAction } from "@/lib/actions/payments";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

export default async function StudentFinesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();
  const fines = await listOwnFines(session!.studentId!);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">My Fines</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <DataTable
        rows={fines as any[]}
        emptyMessage="No fines — you're all clear."
        columns={[
          { header: "Reason", cell: (r: any) => r.reason },
          { header: "Amount", cell: (r: any) => `₹${r.amount}` },
          { header: "Overdue days", cell: (r: any) => r.overdueDays },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "",
            cell: (r: any) =>
              r.status === "PENDING" || r.status === "PARTIALLY_PAID" ? (
                <form action={initiateFinePaymentAction}>
                  <input type="hidden" name="fineId" value={r.fineId} />
                  <input type="hidden" name="studentId" value={session?.studentId} />
                  <button className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">
                    Pay Online
                  </button>
                </form>
              ) : null,
          },
        ]}
      />
      <p className="text-xs text-slate-500">Fines can also be paid in person at the library counter.</p>
    </div>
  );
}
