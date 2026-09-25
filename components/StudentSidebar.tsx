"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  BookMarked,
  History,
  DoorOpen,
  Banknote,
  UserCircle,
  ShieldCheck,
  BookmarkCheck,
  Bell,
  BookOpen,
  LogOut,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

const NAV = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/books", label: "Search Books", icon: Search },
  { href: "/student/my-books", label: "My Books", icon: BookMarked },
  { href: "/student/reservations", label: "Reservations", icon: BookmarkCheck },
  { href: "/student/history", label: "Borrowing History", icon: History },
  { href: "/student/visits", label: "Visit History", icon: DoorOpen },
  { href: "/student/fines", label: "Fines", icon: Banknote },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
  { href: "/student/profile", label: "Profile", icon: UserCircle },
  { href: "/student/clearance", label: "Clearance", icon: ShieldCheck },
];

export function StudentSidebar({
  userName,
  userRole,
}: {
  userName?: string;
  userRole?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex w-full flex-col bg-ink-950 md:h-screen md:w-64 md:shrink-0">
      {/* Brand */}
      <div className="hidden items-center gap-2.5 px-5 pb-5 pt-6 md:flex">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brass-500">
          <BookOpen className="h-4.5 w-4.5 text-ink-950" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-serif text-sm text-white">My Library</p>
          <p className="text-[11px] text-slate-400">Student Portal</p>
        </div>
      </div>

      {/* Nav — horizontal scroll strip on mobile, vertical rail on desktop */}
      <div className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-1 md:flex-col md:gap-0.5 md:overflow-y-auto md:px-3 md:py-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brass-500 font-medium text-ink-950 shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* User card — desktop only */}
      <div className="hidden border-t border-white/10 p-3 md:block">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-600 text-xs font-semibold text-white">
            {(userName ?? "S").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{userName ?? "Student"}</p>
            <p className="truncate text-[11px] text-slate-400">{userRole ?? "Student"}</p>
          </div>
          <form action={logout}>
            <button type="submit" title="Sign out" className="shrink-0 text-slate-400 transition hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
