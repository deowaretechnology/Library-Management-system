"use client";

import dynamic from "next/dynamic";
import config from "@/sanity.config";

// Sanity Studio is a heavy, browser-only application (it touches window/document,
// IndexedDB, etc. at module init). Loading it via next/dynamic with ssr:false keeps
// Next.js from ever trying to execute it on the server — including during
// `next build`'s page-data-collection pass, which otherwise fails because the
// Studio bundle assumes a browser environment.
const NextStudio = dynamic(() => import("next-sanity/studio").then((m) => m.NextStudio), {
  ssr: false,
});

export default function StudioClient() {
  return <NextStudio config={config} />;
}
