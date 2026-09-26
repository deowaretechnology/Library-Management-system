import { getSession } from "@/lib/auth/session";
import { listOwnReservations, cancelReservationAction } from "@/lib/actions/reservations";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { formatIstDate } from "@/lib/domain/dates";

export default async function StudentReservationsPage() {
  const session = await getSession();
  const reservations = await listOwnReservations(session!.studentId!);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">My Reservations</h1>
      <DataTable
        rows={reservations as any[]}
        emptyMessage="No reservations yet — reserve an unavailable title from Search Books."
        columns={[
          { header: "Sanity Book ID", cell: (r: any) => r.sanityBookId },
          { header: "Requested", cell: (r: any) => formatIstDate(r.requestedAt) },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "",
            cell: (r: any) =>
              ["AWAITING_APPROVAL", "PENDING", "READY"].includes(r.status) ? (
                <form action={cancelReservationAction}>
                  <input type="hidden" name="reservationId" value={r.reservationId} />
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                    {r.status === "AWAITING_APPROVAL" ? "Withdraw request" : "Cancel"}
                  </button>
                </form>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
