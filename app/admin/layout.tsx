import { getSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminMobileNav } from "@/components/AdminMobileNav";
import { AssistantWidget } from "@/components/AssistantWidget";
import { AssistantErrorBoundary } from "@/components/AssistantErrorBoundary";
import { logout } from "@/lib/actions/auth";
import { countReservationsAwaitingApproval } from "@/lib/actions/reservations";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession(); // middleware already guarantees an admin-role session here
  // Powers the "Reservations" nav badge — the stand-in for a staff notification system,
  // since student self-reservations now need explicit approval before they're valid.
  const pendingReservationCount = await countReservationsAwaitingApproval().catch(() => 0);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userName={session?.name} userRole={session?.role} pendingReservationCount={pendingReservationCount} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <AdminMobileNav userName={session?.name} userRole={session?.role} pendingReservationCount={pendingReservationCount} />
            <p className="truncate text-sm text-slate-500">
              Signed in as {session?.name} · {session?.role}
            </p>
          </div>
          <form action={logout}>
            <button className="shrink-0 text-sm text-slate-500 hover:text-slate-900" type="submit">
              Sign out
            </button>
          </form>
        </header>
        <main>{children}</main>
      </div>
      <AssistantErrorBoundary>
        <AssistantWidget />
      </AssistantErrorBoundary>
    </div>
  );
}
