"use client";

import { useRef, useTransition } from "react";
import { scanEntryExitAction } from "@/lib/actions/visits";
import { QRScanner } from "@/components/QRScanner";

export function EntryExitScanForm() {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submitWith(studentId: string) {
    const formData = new FormData();
    formData.set("studentId", studentId);
    startTransition(() => {
      scanEntryExitAction(formData);
    });
  }

  return (
    <div className="max-w-md space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Scan or type Student ID</p>
        <QRScanner
          label="Scan Student QR"
          onScan={(text) => {
            if (inputRef.current) inputRef.current.value = text;
            submitWith(text);
          }}
        />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const studentId = inputRef.current?.value.trim();
          if (studentId) submitWith(studentId);
        }}
      >
        <input
          ref={inputRef}
          name="studentId"
          autoFocus
          required
          placeholder="Scan Student ID"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Scanning…" : "Scan"}
        </button>
      </form>
    </div>
  );
}
