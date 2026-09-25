import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export const metadata = { title: "Privacy Policy — College Library" };

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-cream-50">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-forest-600">LEGAL</p>
        <h1 className="mt-3 font-serif text-4xl text-ink-950">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>

        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-slate-600">
          <p>
            This Privacy Policy explains what information the College Library Management System collects from
            students, librarians, and staff who use this platform, and how that information is used, stored, and
            protected.
          </p>

          <section>
            <h2 className="font-serif text-xl text-ink-950">1. Information We Collect</h2>
            <p className="mt-2">When you use this system, we collect:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong>Student accounts:</strong> name, email, phone number, Student ID, Library ID, enrollment number, department, course, and semester.</li>
              <li><strong>Staff accounts:</strong> name and email, used to sign in and to attribute actions (issuing, returning, or updating records) to the staff member who performed them.</li>
              <li><strong>Library activity:</strong> which books are borrowed, reserved, or returned; due dates; fines; and library entry/exit timestamps recorded when your QR code is scanned.</li>
              <li><strong>Technical data:</strong> a session cookie that keeps you signed in, and basic request logs (such as IP address) used for security and rate-limiting.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">2. How We Use Your Information</h2>
            <p className="mt-2">Your information is used only to operate the library, specifically to:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Issue, renew, and return books, and track due dates and fines against your account.</li>
              <li>Record library entry/exit for building access and occupancy purposes.</li>
              <li>Let you sign in, view your borrowing history, and manage your own account.</li>
              <li>Generate anonymous, aggregate statistics (such as total visitors or books issued) shown on this site.</li>
            </ul>
            <p className="mt-2">We do not use your information for advertising, and we do not sell it to anyone.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">3. QR Codes</h2>
            <p className="mt-2">
              Your student QR code encodes only your Student ID — the same identifier already used on your physical
              ID card. It carries no other personal data and is scanned only by library staff, only to issue or
              return a book or to log a library visit.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">4. Who Can See Your Information</h2>
            <p className="mt-2">
              Your borrowing history, fines, and contact details are visible to library staff (Librarians and
              Library Staff accounts) so they can serve you, and to you when you sign in. This information is not
              shared with any other student, and not shared outside the college except where required by law.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">5. Data Storage &amp; Security</h2>
            <p className="mt-2">
              Data is stored in a secured, access-controlled database. Passwords are never stored in plain text —
              they are hashed before being saved. Only signed-in staff accounts with the appropriate role can view
              or manage student records.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">6. Data Retention</h2>
            <p className="mt-2">
              Borrowing and visit history is kept for as long as your account is active with the library, and as
              needed afterward for academic and audit records. You may ask the library to review what information
              is held about you at any time.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">7. Your Choices</h2>
            <p className="mt-2">
              You can review your own profile, borrowing history, and fines at any time from your dashboard, and
              change your password from the login page. For any other request about your data, contact the library
              using the details below.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">8. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this policy from time to time as the system changes. The "Last updated" date at the top
              of this page reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-ink-950">9. Contact Us</h2>
            <p className="mt-2">
              Questions about this policy or your data can be sent to <strong>library@college.edu</strong> or raised
              in person at the library counter.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
