import Link from "next/link";
import {
  Search,
  BookOpen,
  Laptop,
  Users,
  RefreshCw,
  FileText,
  ShieldCheck,
  Building2,
  Globe2,
  Wind,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { getLibraryStats, getFeaturedBooks } from "@/lib/actions/public";
import { getSettings } from "@/lib/actions/settings";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export const dynamic = "force-dynamic";

const SERVICES = [
  { icon: BookOpen, label: "Book Search", desc: "Find books by title, author, subject or category.", tint: "bg-emerald-50 text-emerald-600", ring: "bg-emerald-600" },
  { icon: Laptop, label: "Digital Resources", desc: "Access e-books, journals and research papers.", tint: "bg-orange-50 text-orange-600", ring: "bg-orange-600" },
  { icon: Users, label: "Study Spaces", desc: "Quiet and comfortable spaces for focused learning.", tint: "bg-purple-50 text-purple-600", ring: "bg-purple-600" },
  { icon: RefreshCw, label: "Issue & Return", desc: "Easy and smooth borrowing and returning process.", tint: "bg-rose-50 text-rose-600", ring: "bg-rose-600" },
  { icon: FileText, label: "Research Support", desc: "Get help with your academic research and projects.", tint: "bg-blue-50 text-blue-600", ring: "bg-blue-600" },
  { icon: ShieldCheck, label: "Library Rules", desc: "Guidelines for a better and organized library experience.", tint: "bg-teal-50 text-teal-600", ring: "bg-teal-600" },
];

const WHY = [
  { icon: Building2, label: "Modern Infrastructure", desc: "Spacious, well-equipped and comfortable facilities." },
  { icon: Globe2, label: "Digital Access", desc: "E-books, online journals and global research content." },
  { icon: Wind, label: "Peaceful Environment", desc: "A quiet space to focus and enhance productivity." },
  { icon: Headphones, label: "Expert Support", desc: "Guidance from library staff whenever you need help." },
];

const BOOK_TINTS = [
  "from-forest-600 to-forest-700",
  "from-brass-500 to-brass-600",
  "from-ink-800 to-ink-950",
  "from-rose-500 to-rose-700",
  "from-blue-600 to-blue-800",
  "from-purple-600 to-purple-800",
];

export default async function HomePage() {
  const [stats, books, settings] = await Promise.all([
    getLibraryStats(),
    getFeaturedBooks(6),
    getSettings(),
  ]);

  return (
    <div id="top" className="bg-white">
      <SiteHeader />

      {/* Hero — full-bleed background photo, no boxed image */}
      <section className="relative isolate overflow-hidden bg-ink-950">
        {/* Drop any real photo of your library/campus in public/hero-library.jpg — this is what renders here. */}
        <img
          src="/hero-library.jpg"
          alt="Students studying in the college library"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark gradient so white text stays readable over any photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/40" />

        <div className="relative mx-auto max-w-6xl px-6 pb-0 pt-20">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-wide text-brass-300">YOUR GATEWAY TO KNOWLEDGE</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.1] text-white">
              Discover
              <br />
              <span className="text-forest-400">Learn</span> &amp; <span className="text-brass-400">Grow</span>
              <br />
              at Our College Library
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-cream-100/80">
              Access thousands of books, research materials, digital resources and a
              peaceful study environment to shape a brighter future.
            </p>

            <form action="#collections" className="mt-7 flex max-w-md overflow-hidden rounded-lg border border-white/10 bg-white shadow-lg">
              <span className="flex items-center pl-4 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                placeholder="Search books by title, author, subject or ISBN..."
                className="w-full px-3 py-3 text-sm outline-none"
              />
              <button type="submit" className="bg-forest-600 px-5 text-sm font-medium text-white hover:bg-forest-700">
                Search
              </button>
            </form>
            <p className="mt-3 text-xs text-cream-100/60">
              Popular searches:{" "}
              {["Data Science", "Computer Science", "Engineering", "Management"].map((t, i) => (
                <span key={t}>
                  {i > 0 && " · "}
                  {t}
                </span>
              ))}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/login?role=student"
                className="inline-flex items-center gap-2 rounded-md bg-forest-600 px-5 py-3 text-sm font-medium text-white hover:bg-forest-700"
              >
                <BookOpen className="h-4 w-4" /> Student Login
              </Link>
              <Link
                href="/login?role=staff"
                className="inline-flex items-center gap-2 rounded-md border border-brass-400 px-5 py-3 text-sm font-medium text-brass-300 hover:bg-white/10"
              >
                Librarian Login
              </Link>
            </div>
          </div>
          <div className="h-32 sm:h-40" aria-hidden="true" />
        </div>
      </section>

      {/* Stats bar — deliberately a sibling of the hero <section>, not nested inside it: the
          hero has overflow-hidden (to keep its background photo/gradients inside its box), which
          would clip this card's overlap effect if it lived in there instead. The spacer above
          (h-32/h-40) is taller than this pull-up (-mt-10/-mt-16) on purpose — that gap is what
          keeps the card from crowding the buttons, while the card still floats over the seam. */}
      <div className="mx-auto -mt-10 max-w-6xl px-6 sm:-mt-16">
        <div className="relative z-10 grid grid-cols-2 gap-6 rounded-xl bg-white p-8 shadow-xl sm:grid-cols-5">
          {[
            { icon: BookOpen, value: `${stats.titleCount}+`, label: "Books Available" },
            { icon: Users, value: `${stats.studentCount}+`, label: "Students" },
            { icon: BookOpen, value: `${stats.copyCount}+`, label: "Book Copies" },
            { icon: FileText, value: `${stats.categoryCount}+`, label: "Categories" },
            { icon: Building2, value: `${stats.visitsToday}+`, label: "Visitors Today" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-600">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-serif text-xl text-ink-950">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-6 pb-20 pt-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium tracking-wide text-forest-600">OUR SERVICES</p>
            <h2 className="mt-3 max-w-md font-serif text-3xl text-ink-950">
              All the Resources You Need in One Place
            </h2>
          </div>
          <p className="max-w-sm text-sm text-slate-500">
            Our college library provides a wide range of resources and services to support
            your academic and personal growth.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-100 p-6 shadow-sm">
              <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-medium text-ink-950">{s.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              <span className={`mt-4 flex h-7 w-7 items-center justify-center rounded-full text-white ${s.ring}`}>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose */}
      <section id="about" className="bg-forest-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 to-forest-700 p-10">
            <p className="font-serif text-xl italic leading-snug text-cream-100">
              "A library is not just a place for books, it is a place for ideas, discovery
              and a better tomorrow."
            </p>
            <span className="mt-4 block h-0.5 w-10 bg-brass-400" />
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-forest-600">WHY CHOOSE OUR LIBRARY</p>
            <h2 className="mt-3 font-serif text-3xl text-ink-950">More Than Just Books</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {WHY.map((w) => (
                <div key={w.label} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-600">
                    <w.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-950">{w.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Popular collections — real catalog titles */}
      <section id="collections" className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium tracking-wide text-forest-600">FROM THE CATALOG</p>
            <h2 className="mt-3 font-serif text-3xl text-ink-950">Popular Collections</h2>
          </div>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-600 hover:underline">
            View all books <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {books.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            The catalog is empty right now — add titles in Sanity Studio to feature them here.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {books.map((book, i) => (
              <div key={book._id} className="group">
                {book.coverUrl ? (
                  <div className="aspect-[3/4] overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5">
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div
                    className={`flex aspect-[3/4] flex-col justify-end rounded-lg bg-gradient-to-br p-3 text-white ${BOOK_TINTS[i % BOOK_TINTS.length]}`}
                  >
                    <BookOpen className="mb-2 h-5 w-5 opacity-70" />
                    <p className="font-serif text-sm leading-snug">{book.title}</p>
                  </div>
                )}
                <p className="mt-2 truncate text-xs font-medium text-ink-950">{book.title}</p>
                <p className="truncate text-xs text-slate-500">{book.authors?.[0] ?? "—"}</p>
                {book.category && (
                  <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {book.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rules — real, live settings */}
      <section id="rules" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-medium tracking-wide text-forest-600">BORROWING RULES</p>
          <h2 className="mt-3 font-serif text-3xl text-ink-950">Know Before You Borrow</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="font-serif text-2xl text-forest-600">{settings.borrowingDurationDays} days</p>
              <p className="mt-1 text-sm text-slate-500">Standard borrowing period</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="font-serif text-2xl text-forest-600">{settings.maxBooksPerStudent}</p>
              <p className="mt-1 text-sm text-slate-500">Books a student can hold at once</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="font-serif text-2xl text-forest-600">₹{settings.finePerDay}/day</p>
              <p className="mt-1 text-sm text-slate-500">Fine for an overdue return</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="font-serif text-2xl text-forest-600">{settings.maxRenewals}</p>
              <p className="mt-1 text-sm text-slate-500">Renewals allowed per loan</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-forest-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-12">
          <div>
            <h2 className="font-serif text-2xl text-white">Ready to Explore a World of Knowledge?</h2>
            <p className="mt-2 text-sm text-cream-100/80">
              Sign in to access books, manage your account, view your borrowing history and much more.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login?role=student"
              className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-forest-700 hover:bg-cream-50"
            >
              <BookOpen className="h-4 w-4" /> Student Login
            </Link>
            <Link
              href="/login?role=staff"
              className="inline-flex items-center gap-2 rounded-md border border-white/40 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
