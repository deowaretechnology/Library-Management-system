"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";

/**
 * Renders a scannable QR for a student, encoding their `studentId` — the exact same value
 * already accepted by the "Student ID" field on Quick Issue and Entry/Exit (whether typed,
 * scanned with a hardware barcode gun, or scanned with a phone/webcam camera here). No
 * signing/encryption is applied — this is a convenience layer at the same trust level as
 * typing the ID by hand, same as how book-copy barcodes already work in this system.
 */
export function StudentQRCode({
  studentId,
  studentName,
  size = 168,
}: {
  studentId: string;
  studentName: string;
  size?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  function download() {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${studentId}-library-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
      <div ref={wrapperRef}>
        <QRCodeCanvas value={studentId} size={size} level="M" includeMargin marginSize={2} />
      </div>
      <p className="text-center text-xs text-slate-500">
        {studentName}
        <br />
        <span className="font-mono text-[11px] text-slate-400">{studentId}</span>
      </p>
      <button
        type="button"
        onClick={download}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        <Download className="h-3.5 w-3.5" /> Download QR
      </button>
    </div>
  );
}
