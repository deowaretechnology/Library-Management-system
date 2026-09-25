"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Barcode,
  ArrowRightLeft,
  RotateCw,
  AlertTriangle,
  Banknote,
  PackageX,
  DoorOpen,
  FileBarChart,
  Settings,
  ScrollText,
  BookmarkCheck,
  UserSquare2,
  Building2,
  FolderTree,
  Tags,
  LogOut,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

const NAV = [
  { section: "Library", items: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/books", label: "Books", icon: BookOpen },
    { href: "/admin/book-copies", label: "Book Copies", icon: Barcode },
    { href: "/admin/authors", label: "Authors", icon: UserSquare2 },
    { href: "/admin/publishers", label: "Publishers", icon: Building2 },
    { href: "/admin/categories", label: "Categories", icon: FolderTree },
    { href: "/admin/subjects", label: "Subjects", icon: Tags },
  ]},
  { section: "Students", items: [
    { href: "/admin/students", label: "All Students", icon: Users },
  ]},
  { section: "Transactions", items: [
    { href: "/admin/issue", label: "Issue Book", icon: ArrowRightLeft },
    { href: "/admin/return", label: "Return Book", icon: ArrowRightLeft },
    { href: "/admin/renewals", label: "Renewals", icon: RotateCw },
    { href: "/admin/reservations", label: "Reservations", icon: BookmarkCheck },
    { href: "/admin/overdue", label: "Overdue", icon: AlertTriangle },
    { href: "/admin/fines", label: "Fines", icon: Banknote },
    { href: "/admin/lost-damaged", label: "Lost / Damaged", icon: PackageX },
  ]},
  { section: "Library Access", items: [
    { href: "/admin/entry-exit", label: "Entry / Exit", icon: DoorOpen },
  ]},
  { section: "Reports", items: [
    { href: "/admin/reports", label: "Library Reports", icon: FileBarChart },
  ]},
  { section: "System", items: [
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  ]},
];

export function AdminSidebar({
  userName,
  userRole,
}: {
  userName?: string;
  userRole?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="hidden w-64 shrink-0 flex-col bg-ink-950 md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-600">
          <BookOpen className="h-4.5 w-4.5 text-white" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-serif text-sm text-white">Library Admin</p>
          <p className="text-[11px] text-slate-400">Control Panel</p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-forest-600 font-medium text-white shadow-sm"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User card */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass-500 text-xs font-semibold text-ink-950">
            {(userName ?? "A").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{userName ?? "Admin"}</p>
            <p className="truncate text-[11px] text-slate-400">{userRole ?? "Staff"}</p>
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
