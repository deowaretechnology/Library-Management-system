"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { issueBookFormAction } from "@/lib/actions/transactions";
import { getStudentIssueProfileAction, StudentIssueProfile } from "@/lib/actions/students";
import { QRScanner } from "@/components/QRScanner";

export function IssueForm() {
  const [pending, startTransition] = useTransition();
  const [lookingUp, setLookingUp] = useState(false);
  const [profile, setProfile] = useState<StudentIssueProfile | null>(null);
  const [studentInput, setStudentInput] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

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

  function issue(barcode: string) {
    if (!profile) return;
    const formData = new FormData();
    formData.set("studentId", profile.studentId);
    formData.set("barcode", barcode.trim());
    startTransition(() => {
      issueBookFormAction(formData);
    });
  }

  function reset() {
    setProfile(null);
    setStudentInput("");
    setBarcodeInput("");
    setLookupError(null);
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Step 2 · Scan the book</p>
          <QRScanner label="Scan Book QR" onScan={(text) => issue(text)} />
        </div>
        <div className="flex gap-2">
          <input
            autoFocus
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                issue(barcodeInput);
              }
            }}
            placeholder="Or type/scan copy barcode"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => issue(barcodeInput)}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Issuing…" : "Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
