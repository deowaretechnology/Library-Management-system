"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { getAdminNav } from "./AdminSidebar";

/**
 * The desktop AdminSidebar is `hidden` below the md breakpoint (by design —
 * it doesn't fit as a fixed 256px column on a phone screen), which left
 * mobile/Android-app admins with NO navigation at all beyond the header's
 * "Sign out" — only the dashboard cards were reachable. This is the phone-
 * width replacement: a hamburger button (rendered in the admin header) that
 * opens the same nav links as a slide-in drawer.
 */
export function AdminMobileNav({
  userName,
  userRole,
  pendingReservationCount = 0,
}: {
  userName?: string;
  userRole?: string;
  pendingReservationCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer automatically once a link has actually navigated somewhere.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = getAdminNav(userRole);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-ink-950 shadow-xl">
            <div className="flex items-center justify-between gap-2.5 px-5 pb-5 pt-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-600">
                  <BookOpen className="h-4.5 w-4.5 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-serif text-sm text-white">Library Admin</p>
                  <p className="text-[11px] text-slate-400">Control Panel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-slate-400 transition hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 px-3 pb-4">
              {nav.map((group) => (
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
                          <span className="flex-1 truncate">{label}</span>
                          {href === "/admin/reservations" && pendingReservationCount > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                              {pendingReservationCount > 99 ? "99+" : pendingReservationCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

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
                  <button
                    type="submit"
                    title="Sign out"
                    className="shrink-0 text-slate-400 transition hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
