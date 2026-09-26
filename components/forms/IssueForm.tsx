"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle, RotateCcw, XCircle } from "lucide-react";
import { issueBookAction } from "@/lib/actions/transactions";
import { getBookCopyLookupAction, BookCopyLookup } from "@/lib/actions/bookCopies";
import { getStudentIssueProfileAction, StudentIssueProfile } from "@/lib/actions/students";
import { QRScanner } from "@/components/QRScanner";

export function IssueForm() {
  const [pending, startTransition] = useTransition();
  const [lookingUp, setLookingUp] = useState(false);
  const [profile, setProfile] = useState<StudentIssueProfile | null>(null);
  const [studentInput, setStudentInput] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  // Book-scan confirmation step: scanning/typing a barcode looks the copy up first —
  // it only gets issued once the librarian confirms from the book's own card.
  const [bookLookup, setBookLookup] = useState<BookCopyLookup | null>(null);
  const [bookLookingUp, setBookLookingUp] = useState(false);
  const [bookLookupError, setBookLookupError] = useState<string | null>(null);

  async function lookupStudent(id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLookingUp(true);
    setLookupError(null);
    try {
      const result = await getStudentIssueProfileAction(trimmed);
      if (!result) {
        setLookupError("No student found for that ID.");
        return;
      }
      setProfile(result);
    } finally {
      setLookingUp(false);
    }
  }

  async function lookupBook(barcode: string) {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setBookLookingUp(true);
    setBookLookupError(null);
    setIssueError(null);
    try {
      const result = await getBookCopyLookupAction(trimmed);
      if (!result) {
        setBookLookupError("No book copy found for that barcode.");
        return;
      }
      setBookLookup(result);
    } finally {
      setBookLookingUp(false);
    }
  }

  function cancelBookLookup() {
    setBookLookup(null);
    setBarcodeInput("");
    setBookLookupError(null);
    setIssueError(null);
  }

  function confirmIssue() {
    if (!profile || !bookLookup) return;
    setIssueError(null);
    setIssueSuccess(null);
    startTransition(async () => {
      const result = await issueBookAction(profile.studentId, bookLookup.barcode);
      if ("error" in result) {
        setIssueError(result.error);
        return;
      }
      // Same student can borrow more than one book in a visit — refresh their profile
      // (updated count/eligibility), clear the confirmed book, and keep Step 2 ready
      // for the next scan instead of bouncing back to Step 1.
      setBookLookup(null);
      setBarcodeInput("");
      setIssueSuccess(`"${bookLookup.title}" issued — due ${result.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`);
      const refreshed = await getStudentIssueProfileAction(profile.studentId);
      if (refreshed) setProfile(refreshed);
    });
  }

  function reset() {
    setProfile(null);
    setStudentInput("");
    setBarcodeInput("");
    setLookupError(null);
    setIssueError(null);
    setIssueSuccess(null);
    setBookLookup(null);
    setBookLookupError(null);
  }

  // Step 1 — identify the student
  if (!profile) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Step 1 · Scan the student</p>
          <QRScanner label="Scan Student QR" onScan={(text) => lookupStudent(text)} />
        </div>
        <div className="flex gap-2">
          <input
            autoFocus
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lookupStudent(studentInput);
              }
            }}
            placeholder="Or type/scan Student ID"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={lookingUp}
            onClick={() => lookupStudent(studentInput)}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {lookingUp ? "Looking up…" : "Find"}
          </button>
        </div>
        {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}
      </div>
    );
  }

  // Step 2 — student identified, now scan the book
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
            <p className="text-xs text-slate-500">
              {profile.studentId} · {profile.libraryId} · {profile.department} · Sem {profile.semester}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Borrowed {profile.activeCount} / {profile.maxBooksPerStudent}
              {profile.pendingFineCount > 0 && ` · ${profile.pendingFineCount} pending fine(s)`}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Scan different student
          </button>
        </div>

        <div className="mt-3">
          {profile.eligible ? (
            <p className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Eligible to borrow
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> {profile.ineligibleReason}
            </p>
          )}
        </div>
      </div>

      {profile.eligible && !bookLookup && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Step 2 · Scan the book</p>
            <QRScanner label="Scan Book QR" onScan={(text) => lookupBook(text)} />
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookupBook(barcodeInput);
                }
              }}
              placeholder="Or type/scan copy barcode"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={bookLookingUp}
              onClick={() => lookupBook(barcodeInput)}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {bookLookingUp ? "Looking up…" : "Find"}
            </button>
          </div>
          {issueSuccess && (
            <p className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {issueSuccess} Ready for the next book — scan or type another barcode.
            </p>
          )}
          {bookLookupError && <p className="text-xs text-red-600">{bookLookupError}</p>}
        </div>
      )}

      {profile.eligible && bookLookup && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-700">Step 3 · Confirm the book</p>
          <div className="flex gap-3">
            {bookLookup.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={bookLookup.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-20 w-14 shrink-0 rounded bg-slate-100" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{bookLookup.title}</p>
              {bookLookup.authors.length > 0 && (
                <p className="truncate text-xs text-slate-500">{bookLookup.authors.join(", ")}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {bookLookup.copyId} · {bookLookup.barcode}
              </p>
              <div className="mt-1.5">
                {bookLookup.canIssue ? (
                  <p className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {bookLookup.status === "RESERVED" ? "Reserved — ready to issue" : "Available"}
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    <XCircle className="h-3.5 w-3.5" />
                    {bookLookup.status === "ISSUED" && bookLookup.issuedTo
                      ? `Already issued to ${bookLookup.issuedTo.name} (${bookLookup.issuedTo.libraryId})`
                      : `Not available — ${bookLookup.status.toLowerCase()}`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelBookLookup}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Scan different book
            </button>
            {bookLookup.canIssue && (
              <button
                type="button"
                disabled={pending}
                onClick={confirmIssue}
                className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "Issuing…" : `Issue to ${profile.name}`}
              </button>
            )}
          </div>
          {issueError && <p className="text-xs text-red-600">{issueError}</p>}
        </div>
      )}

      {!profile.eligible && issueSuccess && (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> {issueSuccess} They&apos;re no longer eligible to borrow more ({profile.ineligibleReason}) — scan a different student to continue.
        </p>
      )}
    </div>
  );
}
