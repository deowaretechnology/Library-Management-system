import { getSession } from "@/lib/auth/session";
import { StudentSidebar } from "@/components/StudentSidebar";
import { logout } from "@/lib/actions/auth";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession(); // middleware already guarantees a STUDENT session here

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <StudentSidebar userName={session?.name} userRole={session?.role} />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-sm text-slate-500">Hi, {session?.name}</p>
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
