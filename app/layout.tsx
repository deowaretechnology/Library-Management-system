import type { Metadata, Viewport } from "next";
// import { Fraunces } from "next/font/google"; // stubbed for sandbox build verification (no network font fetch)
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const displayFont = { variable: "font-display-stub" };

export const metadata: Metadata = {
  title: "College Library Management System",
  description: "Admin/Librarian and Student panels for the college library.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "College Library",
  },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#123E2C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={displayFont.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
