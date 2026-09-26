"use client";

import { useActionState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { changePassword, ChangePasswordState } from "@/lib/actions/auth";

const initialState: ChangePasswordState = {};

function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const searchParams = useSearchParams();
  // Sent here by login() when a student signs in with the default password (their Library ID).
  const firstLogin = searchParams.get("first") === "1";
  const prefillId = searchParams.get("id") ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/login" className="text-xs text-slate-500 hover:underline">
          ← Back to sign in
        </Link>
        <h2 className="mt-2 font-serif text-2xl text-ink-950">Change your password</h2>
        {firstLogin ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your password is still the default (your Library ID). For your account&apos;s safety,
            set a new password first — then sign in with it.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Enter your ID and current password, then choose a new one. You&apos;ll be sent back to
            sign in once it&apos;s updated.
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="identifier" className="text-sm font-medium text-slate-700">
              Email or Student / Library ID
            </label>
            <input
              id="identifier"
              name="identifier"
              autoFocus={!prefillId}
              defaultValue={prefillId}
              required
              placeholder="e.g. LIB-1001 or you@library.local"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="currentPassword" className="text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoFocus={!!prefillId}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <p className="text-xs text-slate-500">
              If you've never changed it, this is the same as your Library ID.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <p className="text-xs text-slate-500">At least 8 characters.</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
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
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChangePasswordForm />
    </Suspense>
  );
}
