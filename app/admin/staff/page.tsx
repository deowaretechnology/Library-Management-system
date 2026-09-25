import { getSession } from "@/lib/auth/session";
import { listStaff, toggleStaffStatusAction } from "@/lib/actions/staff";
import { CreateStaffForm } from "@/components/forms/CreateStaffForm";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  LIBRARIAN: "Librarian",
  LIBRARY_STAFF: "Library Staff",
};

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;
  const [session, staff] = await Promise.all([getSession(), listStaff()]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Staff ({staff.length})</h1>
      <p className="-mt-4 text-sm text-slate-500">
        Only a Super Admin can add or deactivate Librarian / Library Staff accounts.
      </p>

      {created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">Staff account created — {created}</p>
          <p className="mt-1 text-xs text-emerald-700">
            Share the password you set with them directly. They can sign in at /login (Librarian / Staff tab) and
            change it anytime from "Change your password".
          </p>
        </div>
      )}

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a staff account</summary>
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateStaffForm />
      </details>

      <DataTable
        rows={staff as any[]}
        emptyMessage="No staff accounts yet."
        columns={[
          { header: "Name", cell: (r: any) => r.name },
          { header: "Email", cell: (r: any) => r.email },
          { header: "Role", cell: (r: any) => ROLE_LABEL[r.role] ?? r.role },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
          {
            header: "Action",
            cell: (r: any) =>
              String(r._id) === session?.userId ? (
                <span className="text-xs text-slate-400">This is you</span>
              ) : (
                <form action={toggleStaffStatusAction}>
                  <input type="hidden" name="userId" value={String(r._id)} />
                  <button
                    type="submit"
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      r.status === "ACTIVE"
                        ? "border-red-200 text-red-700 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {r.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              ),
          },
        ]}
      />
    </div>
  );
}
