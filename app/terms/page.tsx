import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export const metadata = { title: "Terms & Conditions — College Library" };

export default function TermsPage() {
  return (
    <div className="bg-cream-50">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-forest-600">LEGAL</p>
        <h1 className="mt-3 font-serif text-4xl text-ink-950">Terms &amp; Conditions</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>

        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-slate-600">
          <p>
            These Terms &amp; Conditions govern the use of the College Library Management System by students,
            librarians, and staff. By signing in, you agree to the terms below.
          </p>

          <section>
            <h2 className="font-serif text-xl text-ink-950">1. Eligibility</h2>
            <p className="mt-2">
              Access is limited to currently enrolled students and authorized library staff of the college. Accounts
              are created by library staff and are not open to public self-registration.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">2. Account Responsibility</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>You are responsible for keeping your password confidential and for all activity under your account.</li>
              <li>Your starting password is the same as your Library ID — you're expected to change it on first sign-in.</li>
              <li>Report a lost or compromised password, or a lost Library ID card/QR code, to the library immediately.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">3. Borrowing Rules</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Each student may borrow up to the maximum number of books set by library policy at any one time.</li>
              <li>Books must be returned by the due date shown on your dashboard; renewals are allowed where a book is not reserved by another student and your account has no outstanding fines.</li>
              <li>Overdue books accrue a fine as set by library policy, charged per day past the due date.</li>
              <li>A book reported lost or returned damaged will be charged at its replacement cost, as assessed by library staff.</li>
              <li>Outstanding fines must be cleared before further books can be issued or before final clearance is granted.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">4. Library QR Codes</h2>
            <p className="mt-2">
              Your student QR code and each book's QR code are used to issue books, return books, and log library
              visits. Do not share your QR code or let another student use it to borrow books on your behalf — you
              remain responsible for anything issued against your account.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">5. Acceptable Use</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Use the system only for its intended purpose — browsing the catalog, borrowing/returning books, and managing your own account.</li>
              <li>Do not attempt to access another student's account, records, or fines.</li>
              <li>Do not attempt to circumvent borrowing limits, fines, or access controls.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">6. Library Conduct</h2>
            <p className="mt-2">
              Physical use of the library and its books remains subject to the college's library rules regarding
              conduct, noise, and care of materials, in addition to these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">7. Suspension</h2>
            <p className="mt-2">
              Library staff may suspend an account for misuse, repeated overdue books, unpaid fines, or violation of
              these Terms. A suspended account cannot borrow books until the issue is resolved.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">8. Changes to These Terms</h2>
            <p className="mt-2">
              These Terms may be updated as library policy changes. Continued use of the system after an update
              means you accept the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">9. Contact Us</h2>
            <p className="mt-2">
              For questions about these Terms, reach out to <strong>library@college.edu</strong> or visit the library
              counter.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
