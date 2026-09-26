import {
  listReservations,
  cancelReservationAction,
  approveReservationAction,
  rejectReservationAction,
} from "@/lib/actions/reservations";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatIstDate } from "@/lib/domain/dates";

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const reservations = await listReservations(status);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Reservations ({reservations.length})</h1>

      <form className="flex gap-2" action="/admin/reservations">
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {["AWAITING_APPROVAL", "PENDING", "READY", "FULFILLED", "CANCELLED", "EXPIRED"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Filter</button>
      </form>

      <DataTable
        rows={reservations as any[]}
        emptyMessage="No reservations."
        columns={[
          { header: "Student", cell: (r: any) => r.studentId?.name },
          { header: "Sanity Book ID", cell: (r: any) => r.sanityBookId },
          { header: "Requested", cell: (r: any) => formatIstDate(r.requestedAt) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "",
            cell: (r: any) =>
              r.status === "AWAITING_APPROVAL" ? (
                <div className="flex gap-1.5">
                  <form action={approveReservationAction}>
                    <input type="hidden" name="reservationId" value={r.reservationId} />
                    <button className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">
                      Approve
                    </button>
                  </form>
                  <form action={rejectReservationAction}>
                    <input type="hidden" name="reservationId" value={r.reservationId} />
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                      Reject
                    </button>
                  </form>
                </div>
              ) : r.status === "PENDING" || r.status === "READY" ? (
                <form action={cancelReservationAction}>
                  <input type="hidden" name="reservationId" value={r.reservationId} />
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Cancel</button>
                </form>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
