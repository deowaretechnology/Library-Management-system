"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * There was no error boundary anywhere in the app, so any server error (a DB blip, an
 * expired session hitting a protected action, an unexpected bug) showed Next's bare
 * "Application error" screen with no way forward. This gives a readable page with
 * Retry and a way back to sign-in. Details stay in the server logs (production error
 * messages are redacted by Next.js — only the digest reaches the browser).
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-2xl text-ink-950">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">
          This page couldn&apos;t load right now. Try again — if it keeps happening, sign in again
          or contact the library desk.
        </p>
        {error.digest && <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <Link
            href="/api/auth/signout?reason=expired"
            prefetch={false}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}
