"use client";

import { useActionState, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { login, LoginState } from "@/lib/actions/auth";

const initialState: LoginState = {};

type Role = "student" | "staff";

const COPY: Record<Role, { label: string; placeholder: string; helper: string }> = {
  student: {
    label: "Library ID",
    placeholder: "e.g. LIB-1001",
    helper: "New here? Your starting password is the same as your Library ID — change it below.",
  },
  staff: {
    label: "Email",
    placeholder: "you@library.local",
    helper: "Use the email your library account was created with.",
  },
};

function LoginForm() {
  const searchParams = useSearchParams();
  const initialRole: Role = searchParams.get("role") === "staff" ? "staff" : "student";
  const [role, setRole] = useState<Role>(initialRole);
  const [state, formAction, pending] = useActionState(login, initialState);
  const copy = COPY[role];
  const passwordChanged = searchParams.get("passwordChanged") === "1";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branded panel */}
      <div className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass-400 to-transparent"
          aria-hidden
        />
        <p className="font-serif text-sm italic text-brass-300">College Library</p>
        <div>
          <h1 className="max-w-sm font-serif text-3xl leading-tight text-white">
            Every book has a shelf. Every loan has a record.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            One sign-in for students and staff alike — the system knows which you are
            by what you type below.
          </p>
        </div>
        <p className="text-xs text-slate-500">College Library Management System</p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-6 py-16">
        <Link
          href="/"
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-ink-950 sm:left-6 sm:top-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>

        <div className="w-full max-w-sm">
          <h2 className="font-serif text-2xl text-ink-950">Sign in</h2>

          {passwordChanged && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Password updated — sign in with your new password.
            </p>
          )}

          <div className="mt-6 inline-flex rounded-md border border-slate-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`rounded px-4 py-1.5 font-medium transition ${
                role === "student" ? "bg-brass-500 text-ink-950" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setRole("staff")}
              className={`rounded px-4 py-1.5 font-medium transition ${
                role === "staff" ? "bg-forest-500 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Librarian / Staff
            </button>
          </div>

          <form action={formAction} className="mt-6 space-y-4">
            <div className="space-y-1">
              <label htmlFor="identifier" className="text-sm font-medium text-slate-700">
                {copy.label}
              </label>
              <input
                id="identifier"
                name="identifier"
                autoFocus
                required
                placeholder={copy.placeholder}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <p className="text-xs text-slate-500">{copy.helper}</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            {state.error && <p className="text-sm text-red-600">{state.error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-sm text-slate-500">
              <Link href="/change-password" className="text-brand-600 hover:underline">
                Change your password
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
