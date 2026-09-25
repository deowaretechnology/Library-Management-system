"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) once, client-side only.
 * Silently no-ops on browsers without support (or inside the Capacitor
 * WebView, where it's harmless but unnecessary) — never blocks rendering.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability/offline fallback is a nice-to-have, not critical —
      // fail silently rather than surface an error to the user.
    });
  }, []);

  return null;
}
