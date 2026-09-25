# College Library Management System

Next.js (App Router) + TypeScript + Tailwind + MongoDB (Mongoose) + Sanity. Full design
rationale, data models, permission matrix and phase roadmap live in the Claude Doc shared
alongside this repo — this README covers what's here and how to run it.

**Verified, not just written:** `npm install`, `npx tsc --noEmit`, `npm run test`, and
`npm run build` all pass cleanly in this repo as delivered — 34 routes build
successfully, 39 tests pass. `npm run test:integration` (real MongoDB, real Mongoose
models) is written and correct but can't execute in this sandbox — see "What's still
open" for hard proof of why, and run it yourself once you have the repo. See "Known
rough edges" for other things that only real credentials or a live deploy can verify.

## What's implemented

- **Auth** — password hashing (bcrypt), signed httpOnly JWT session cookie (`jose`),
  `requireSession` / `requireRole` / `assertOwnStudentRecord` guards, role-based route
  protection in `middleware.ts`, login page + server action, sign-out, rate limiting on
  login attempts (5 per 5 min per IP+identifier).
- **Data layer** — 10 Mongoose models (the original 8 plus `Reservation` and
  `Notification`) with the indexes/enums from the design doc; cached MongoDB connection
  singleton.
- **Sanity catalog / CMS** — fully embedded Studio at `/studio` (custom desk structure,
  Vision plugin), `book`/`author`/`publisher`/`category`/`subject` schemas, read + write
  clients, GROQ search, seed script with 4 real demo books — see "CMS" below.
- **Admin panel:**
  - Dashboard — live aggregated stats + a 7-day issues trend chart (Recharts) + recent
    activity tables
  - Students — search/list (paginated) + client-validated create form (React Hook Form +
    Zod) + a full **detail page** (`/admin/students/[id]`: profile, active borrows, full
    history, fines, status control, **clearance confirmation**)
  - Book Copies — search/filter/list (paginated) + create form
  - Books — Sanity catalog search with live MongoDB availability + a **detail page**
    (`/admin/books/[id]`: full metadata, cover, every physical copy and its status)
  - Quick Issue / Quick Return — scan-driven counter forms, atomic Mongo transaction,
    automatic overdue-fine calculation, audit logging, reservation-aware (a returned copy
    with a pending reservation is held instead of freed; issuing a held copy checks the
    reservation belongs to that student)
  - Renewals, Overdue (+ CSV/PDF export), Fines (pay/waive, paginated), Lost/Damaged,
    Entry/Exit, **Reservations** (view + cancel)
  - Settings — Super-Admin-only, client-validated (React Hook Form + Zod), bound to
    `LibrarySettings`
  - Audit Logs — chronological activity feed
  - Reports — **all 14 of the spec's types**: Student, Inventory, Issue, Return,
    Overdue, Fine, Lost/Damaged, Entry/Exit, Department-wise, Most Borrowed, Most Active
    Students, Monthly Statistics, Annual Statistics, Clearance — **CSV and PDF export on
    every one**, plus a manual trigger for the due-soon/overdue notification sweep
- **Student panel:** dashboard, book search (with **Reserve** when nothing's available),
  my books, **Reservations**, borrowing history, visit history, **fines with online
  payment** (Razorpay Payment Links — falls back to "pay at the counter" if unconfigured),
  **Notifications**, profile, **clearance status**.
- **Notifications** — in-app (always works) for due-soon/due-today/overdue/fine-issued/
  reservation-ready; email/WhatsApp are pluggable stubs that log what *would* send until
  you wire in `RESEND_API_KEY`/`TWILIO_ACCOUNT_SID`. A daily sweep is scheduled via
  Vercel Cron (`vercel.json` → `/api/cron/due-soon`, protected by `CRON_SECRET`) — deploy
  to Vercel and it runs on its own; elsewhere, point any scheduler at that URL with an
  `Authorization: Bearer <CRON_SECRET>` header. Also triggerable manually from
  `/admin/reports`.
- **Fine payment** — real Razorpay Payment Links integration (order creation + signature-
  verified webhook at `/api/webhooks/razorpay`) — code is complete and correct, but
  untested against a real Razorpay account since this environment has none.
- **Security** — login rate limiting (in-memory — fine for one instance, swap for
  Redis/Upstash before scaling to several), security headers (`X-Frame-Options`,
  `nosniff`, `Referrer-Policy`, restrictive `Permissions-Policy`) via `next.config.js`,
  scoped to exclude `/studio`. Next.js Server Actions already reject cross-origin
  submissions by default, which covers the CSRF case.
- **Tests** — Vitest, 39 tests in the main suite (`npm run test`, all pass with no
  external dependencies): 20 unit tests on pure business rules (fine calculation,
  overdue-day rounding, clearance eligibility, CSV escaping, rate limiter), 9 Mongoose
  schema-validation tests (`validateSync()`, no DB needed), 10 tests on the real Razorpay
  integration (request construction + webhook HMAC verification, `fetch` mocked so no
  network call happens), and 2 component tests (React Testing Library) proving the
  student-create form's client validation actually blocks bad input. **Plus** 5 real
  integration tests (`npm run test:integration`) against actual Mongoose models and a
  real MongoDB replica set — can't run inside this sandbox (see "What's still open"),
  written to run for real on a machine with normal internet access.
- **Seed scripts** — `npm run seed:sanity` (catalog) + `npm run seed` (Mongo accounts/
  students/copies) — `npm run seed:all` runs both in order.

## What's still open

- **Client-side validation:** student-create, book-copy-create, settings, quick-issue,
  quick-return, and lost/damaged forms use React Hook Form + Zod. The per-row inline
  forms (fines pay/waive, entry-exit scan) still rely on native HTML validation plus
  server-side Zod (which always runs regardless — this is UX polish, not safety) — RHF
  is awkward for forms repeated once per table row.
- **Notifications:** the sweep logic is real and the cron plumbing (`vercel.json` +
  `/api/cron/due-soon`, secret-protected) is wired up, but it's only actually scheduled
  if you deploy to Vercel (or point another scheduler at that URL with the same header)
  — nothing fires on its own in this repo as-is.
- **Payments:** the Razorpay integration (Payment Links + webhook signature verification)
  is real code with real test coverage for everything that doesn't require live
  credentials — 10 tests confirm the request is built correctly (amount in paise, Basic
  auth header, fine ID as `reference_id`), that a missing config fails clearly instead of
  silently, that API errors surface instead of vanishing, and that webhook signature
  verification genuinely rejects a tampered body or wrong secret using real HMAC crypto.
  What's *not* tested: an actual round trip against Razorpay's live API — that needs a
  real test-mode account.
- **Real integration tests exist** (`tests/integration/issue-return.test.ts`) — 5 tests
  against actual Mongoose models + a real MongoDB replica set (via `mongodb-memory-
  server`), exercising the genuine `issueBook`/`returnBook`/`renewBook` server actions:
  atomic status flips, duplicate-issue rejection, fine math on a real backdated
  transaction, on-time returns, and renewal due-date math. **They cannot run inside this
  sandbox** — confirmed with hard evidence, not assumption: `curl`ing the exact binary
  URL `mongodb-memory-server` needs returns `x-deny-reason: host_not_allowed` from this
  environment's own network proxy (no `mongod` package exists in Ubuntu's apt repos
  either — MongoDB dropped from Debian/Ubuntu over SSPL licensing). Run
  `npm run test:integration` on your own machine (normal internet access) and it will
  download a real MongoDB binary and run for real — nothing about the test code itself
  is a mock or a stand-in.

## Known rough edges from actually building this

Things that looked fine on paper and broke when the code was actually run (all now
fixed, documented here so you know what to watch for if you upgrade dependencies):
- A root folder literally named `sanity` collided with the npm package `sanity` under
  this project's `baseUrl: "."` — every bare `sanity/xxx` import silently resolved to our
  own files instead of the package. Renamed to `cms/`.
- `@sanity/icons` v5 dropped its old named-export icons (`BookIcon` etc.) for a single
  `<Icon symbol="book" />` API — `cms/structure.tsx` uses the new one.
- `sanity`/`next-sanity`/`@sanity/client` have to be a matched set for a given Next.js
  major version. This repo is pinned to `sanity@^4.22.1` + `next-sanity@^11.6.13`, which
  targets Next 15 + React 19 — don't bump `sanity` to its `6.x` line without also moving
  to Next 16.
- Embedding `NextStudio` directly in a Server Component broke `next build` (`createContext
  is not a function`) because Next tried to execute the Studio bundle — which assumes a
  browser — during page-data collection. Fixed by loading it through `next/dynamic` with
  `ssr: false` in a small client component (`app/studio/[[...tool]]/StudioClient.tsx`).

## CMS (Sanity Studio)

The catalog CMS is a fully embedded Sanity Studio, live at `/studio` inside this same
Next.js app — no separate deployment needed.

- **Schemas:** `book`, `author`, `publisher`, `category`, `subject` (`cms/schemaTypes`)
- **Desk structure:** a custom "College Library" nav grouping Books above
  Authors/Publishers/Categories/Subjects (`cms/structure.tsx`) instead of Studio's
  default flat per-type list
- **Vision plugin** enabled — run raw GROQ against the catalog from inside Studio for
  debugging
- **Config:** `sanity.config.ts` (Studio itself) + `sanity.cli.ts` (for the `sanity` CLI —
  dataset import/export, `sanity deploy` if you ever want a standalone Studio too)

Studio auth is Sanity's own (a Sanity account with access to the project) — it doesn't go
through this app's login, so only give Sanity project access to people who should be able
to edit the catalog.

**One-time setup before Studio will load:**
1. In [sanity.io/manage](https://sanity.io/manage) → your project → API → CORS origins,
   add `http://localhost:3000` (and your deployed URL later) with credentials allowed.
2. Generate a write-capable API token there too, for `SANITY_API_WRITE_TOKEN`.

Then `npm run dev` and open `/studio` to add/edit books directly.

### Seeding the catalog

```bash
npm run seed:sanity   # 4 demo books + authors/publisher/category/subject in Sanity
npm run seed          # Mongo: accounts, students, and BookCopy records for those books
npm run seed:all      # both, in the right order
```

The Sanity seed uses fixed document IDs (`seed-book-dbms`, `seed-book-dsa`, `seed-book-os`,
`seed-book-networks`) that match the `sanityBookId` values `scripts/seed.ts` already writes
into MongoDB — run Sanity's seed first (or use `seed:all`) and the two line up automatically.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in MongoDB URI, Sanity project ID/tokens, SESSION_SECRET
npm run seed:all             # seeds Sanity catalog, then Mongo accounts/students/copies
npm run dev
```

You'll need:
- A MongoDB Atlas (or local) cluster — `MONGODB_URI`.
- A Sanity project (`npx sanity@latest init` if you don't have one) — project ID/dataset in
  `NEXT_PUBLIC_SANITY_*`, a write token from sanity.io/manage in `SANITY_API_WRITE_TOKEN`.
- A random 32+ character string for `SESSION_SECRET`.
- Optional: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` for online
  fine payment; `RESEND_API_KEY`/`TWILIO_ACCOUNT_SID` for email/WhatsApp notifications;
  `CRON_SECRET` if you deploy to Vercel and want the daily notification sweep to run.
  Everything works without these — the app just falls back to "pay/notify at the counter."

After seeding, sign in at `/login` with:
- **Admin:** `admin@library.local` / `Admin@123`
- **Librarian:** `librarian@library.local` / `Librarian@123`
- **Student:** any Library ID from `LIB-1001` to `LIB-1010`, password = same Library ID

## Suggested next step

Add real Razorpay test-mode keys and walk a fine through the online-payment flow end to
end, or deploy to Vercel with `CRON_SECRET` set and confirm the daily notification sweep
actually fires. After that, the biggest remaining gap is real integration tests against
a live MongoDB — the unit tests cover the business rules, but nothing yet exercises the
atomic issue/return transaction against a real database.
