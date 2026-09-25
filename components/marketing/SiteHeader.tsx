import Link from "next/link";
import { BookOpen, Search } from "lucide-react";

const NAV = [
  { href: "#top", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#collections", label: "Books" },
  { href: "#services", label: "Services" },
  { href: "#rules", label: "Rules" },
  { href: "#footer", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-cream-100 bg-cream-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="#top" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-600 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-serif text-lg leading-tight text-ink-950">College Library</span>
            <span className="block text-[11px] leading-tight text-slate-500">Learn · Explore · Grow</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-ink-950">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a href="#collections" aria-label="Search the catalog" className="hidden text-slate-500 hover:text-ink-950 sm:block">
            <Search className="h-4 w-4" />
          </a>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-ink-950 hover:border-slate-400"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="hidden rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 sm:block"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
