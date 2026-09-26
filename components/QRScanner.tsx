"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

/**
 * A phone/webcam camera-based QR scanner. Point-and-scan is a convenience alternative to
 * typing the Student ID by hand or using a hardware barcode gun — the decoded text is
 * handed to `onScan` exactly as read, same as the manual-entry field it's paired with.
 */
export function QRScanner({
  onScan,
  label = "Scan with camera",
}: {
  onScan: (text: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawId = useId();
  const elementId = `qr-reader-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            onScan(decodedText.trim());
            setOpen(false);
          },
          () => {
            // per-frame "no QR found yet" — expected while aiming the camera, ignore
          }
        );
      } catch {
        setError("Could not access the camera. Check the browser's camera permission and try again.");
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        // scanner.stop() throws SYNCHRONOUSLY (not a rejected promise) when the
        // scanner never actually got to a running state — e.g. camera access
        // failed above and this cleanup fires when the user closes the
        // scanner or navigates away. An uncaught throw here, inside a React
        // effect cleanup, escapes past any .catch() on the promise chain and
        // can crash the whole page. Guard the call itself, not just its promise.
        try {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {
              // stop() started but clear() (or the close) failed — nothing more to do
            });
        } catch {
          // scanner was never running (e.g. permission denied) — nothing to stop
        }
      }
    };
  }, [open, elementId, onScan]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <Camera className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-black p-2">
      <div className="flex items-center justify-between pb-2">
        <p className="text-xs text-white/70">Point the camera at the student&apos;s QR code</p>
        <button type="button" onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div id={elementId} className="overflow-hidden rounded-md" />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
