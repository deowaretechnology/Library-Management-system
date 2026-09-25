import { getSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/AdminSidebar";
import { logout } from "@/lib/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession(); // middleware already guarantees an admin-role session here

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userName={session?.name} userRole={session?.role} />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-sm text-slate-500">Signed in as {session?.name} · {session?.role}</p>
          <form action={logout}>
            <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
              Sign out
            </button>
          </form>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
