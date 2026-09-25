import Link from "next/link";
import { BookOpen, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer id="footer" className="bg-forest-700 text-cream-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="font-serif text-lg text-white">College Library</p>
              <p className="text-[11px] text-cream-100/70">Learn · Explore · Grow</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Quick Links</p>
          <ul className="mt-3 space-y-2 text-sm text-cream-100/80">
            <li><a href="#top" className="hover:text-white">Home</a></li>
            <li><a href="#about" className="hover:text-white">About</a></li>
            <li><a href="#collections" className="hover:text-white">Books</a></li>
            <li><a href="#services" className="hover:text-white">Services</a></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Help</p>
          <ul className="mt-3 space-y-2 text-sm text-cream-100/80">
            <li><a href="#rules" className="hover:text-white">Library Rules</a></li>
            <li><Link href="/login?role=student" className="hover:text-white">Student Sign in</Link></li>
            <li><Link href="/login?role=staff" className="hover:text-white">Librarian Sign in</Link></li>
            {/* Deliberately placed down here, not in the hero with Student/Librarian —
                same underlying /login form (role is read from the database, not picked
                on this button), just not advertised to every visitor. */}
            <li><Link href="/login?role=staff" className="text-cream-100/50 hover:text-white">Admin Login</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Contact Us</p>
          <ul className="mt-3 space-y-2 text-sm text-cream-100/80">
            <li>library@college.edu</li>
            <li>College Campus, City, India</li>
          </ul>
          <div className="mt-4 flex gap-3 text-cream-100/70">
            <Facebook className="h-4 w-4" />
            <Instagram className="h-4 w-4" />
            <Twitter className="h-4 w-4" />
            <Youtube className="h-4 w-4" />
            <Linkedin className="h-4 w-4" />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-cream-100/60">
        College Library Management System
      </div>
    </footer>
  );
}
