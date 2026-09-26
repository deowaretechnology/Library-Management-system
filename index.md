# UI screenshots

| | |
|---|---|
| Source branch | `ui-pipeline` |
| Commit | [`42ac222`](https://github.com/deowaretechnology/Library-Management-system/commit/42ac2229b66a5cbeea3ead8eb5d78962d0bfd842) (`42ac2229b66a5cbeea3ead8eb5d78962d0bfd842`) |
| Captured (UTC) | 2026-09-26 20:07:53 |
| Workflow run | [36268112313](https://github.com/deowaretechnology/Library-Management-system/actions/runs/36268112313) |
| Result | 83 of 83 captured, 2 flagged |

Rendered by `next start` against a throwaway MongoDB seeded by `scripts/ui-screenshots/seed.ts`
(the book catalog is the real Sanity dataset). Admin pages are signed in as Neha Kapoor
(`admin@demo.local` / `Admin@12345`), student pages as Aarav Sharma
(`LIB-1001` / `Student@123`). Book detail: Introduction to Algorithms.

## desktop (1440×900, 1x)

| Page | URL | HTTP | Result | Problems / notes | Screenshot |
|---|---|---|---|---|---|
| public-home | `/` | 200 | OK | sub-request 404 /hero-library.jpg; console: Failed to load resource: the server responded with a status of 404 (Not Found) | [public-home.jpg](screenshots/desktop/public-home.jpg) |
| public-login | `/login` | 200 | OK |   | [public-login.jpg](screenshots/desktop/public-login.jpg) |
| public-change-password-first | `/change-password?first=1&id=LIB-1001` | 200 | OK |   | [public-change-password-first.jpg](screenshots/desktop/public-change-password-first.jpg) |
| public-catalog | `/catalog` | 404 | FLAGGED | HTTP 404; console: Failed to load resource: the server responded with a status of 404 (Not Found) | [public-catalog.jpg](screenshots/desktop/public-catalog.jpg) |
| public-not-found | `/this-page-does-not-exist` | 404 | OK | console: Failed to load resource: the server responded with a status of 404 (Not Found) | [public-not-found.jpg](screenshots/desktop/public-not-found.jpg) |
| public-privacy-policy | `/privacy-policy` | 200 | OK |   | [public-privacy-policy.jpg](screenshots/desktop/public-privacy-policy.jpg) |
| public-terms | `/terms` | 200 | OK |   | [public-terms.jpg](screenshots/desktop/public-terms.jpg) |
| admin-dashboard | `/admin/dashboard` | 200 | OK |   | [admin-dashboard.jpg](screenshots/desktop/admin-dashboard.jpg) |
| admin-issue | `/admin/issue` | 200 | OK |   | [admin-issue.jpg](screenshots/desktop/admin-issue.jpg) |
| admin-issue-student-loaded | `/admin/issue` | 200 | OK |   | [admin-issue-student-loaded.jpg](screenshots/desktop/admin-issue-student-loaded.jpg) |
| admin-return | `/admin/return` | 200 | OK |   | [admin-return.jpg](screenshots/desktop/admin-return.jpg) |
| admin-renewals | `/admin/renewals` | 200 | OK |   | [admin-renewals.jpg](screenshots/desktop/admin-renewals.jpg) |
| admin-reservations | `/admin/reservations` | 200 | OK |   | [admin-reservations.jpg](screenshots/desktop/admin-reservations.jpg) |
| admin-reservations-awaiting-approval | `/admin/reservations?status=AWAITING_APPROVAL` | 200 | OK |   | [admin-reservations-awaiting-approval.jpg](screenshots/desktop/admin-reservations-awaiting-approval.jpg) |
| admin-overdue | `/admin/overdue` | 200 | OK |   | [admin-overdue.jpg](screenshots/desktop/admin-overdue.jpg) |
| admin-fines | `/admin/fines` | 200 | OK |   | [admin-fines.jpg](screenshots/desktop/admin-fines.jpg) |
| admin-lost-damaged | `/admin/lost-damaged` | 200 | OK |   | [admin-lost-damaged.jpg](screenshots/desktop/admin-lost-damaged.jpg) |
| admin-entry-exit | `/admin/entry-exit` | 200 | OK |   | [admin-entry-exit.jpg](screenshots/desktop/admin-entry-exit.jpg) |
| admin-students | `/admin/students` | 200 | OK |   | [admin-students.jpg](screenshots/desktop/admin-students.jpg) |
| admin-student-detail | `/admin/students/STU-2026-1001` | 200 | OK |   | [admin-student-detail.jpg](screenshots/desktop/admin-student-detail.jpg) |
| admin-books | `/admin/books` | 200 | OK |   | [admin-books.jpg](screenshots/desktop/admin-books.jpg) |
| admin-book-detail | `/admin/books/seed-book-dsa` | 200 | OK |   | [admin-book-detail.jpg](screenshots/desktop/admin-book-detail.jpg) |
| admin-book-copies | `/admin/book-copies` | 200 | OK |   | [admin-book-copies.jpg](screenshots/desktop/admin-book-copies.jpg) |
| admin-authors | `/admin/authors` | 200 | OK |   | [admin-authors.jpg](screenshots/desktop/admin-authors.jpg) |
| admin-publishers | `/admin/publishers` | 200 | OK |   | [admin-publishers.jpg](screenshots/desktop/admin-publishers.jpg) |
| admin-categories | `/admin/categories` | 200 | OK |   | [admin-categories.jpg](screenshots/desktop/admin-categories.jpg) |
| admin-subjects | `/admin/subjects` | 200 | OK |   | [admin-subjects.jpg](screenshots/desktop/admin-subjects.jpg) |
| admin-reports | `/admin/reports` | 200 | OK |   | [admin-reports.jpg](screenshots/desktop/admin-reports.jpg) |
| admin-settings | `/admin/settings` | 200 | OK |   | [admin-settings.jpg](screenshots/desktop/admin-settings.jpg) |
| admin-staff | `/admin/staff` | 200 | OK |   | [admin-staff.jpg](screenshots/desktop/admin-staff.jpg) |
| admin-audit-logs | `/admin/audit-logs` | 200 | OK |   | [admin-audit-logs.jpg](screenshots/desktop/admin-audit-logs.jpg) |
| student-dashboard | `/student/dashboard` | 200 | OK |   | [student-dashboard.jpg](screenshots/desktop/student-dashboard.jpg) |
| student-books | `/student/books` | 200 | OK |   | [student-books.jpg](screenshots/desktop/student-books.jpg) |
| student-my-books | `/student/my-books` | 200 | OK |   | [student-my-books.jpg](screenshots/desktop/student-my-books.jpg) |
| student-reservations | `/student/reservations` | 200 | OK |   | [student-reservations.jpg](screenshots/desktop/student-reservations.jpg) |
| student-history | `/student/history` | 200 | OK |   | [student-history.jpg](screenshots/desktop/student-history.jpg) |
| student-visits | `/student/visits` | 200 | OK |   | [student-visits.jpg](screenshots/desktop/student-visits.jpg) |
| student-fines | `/student/fines` | 200 | OK |   | [student-fines.jpg](screenshots/desktop/student-fines.jpg) |
| student-notifications | `/student/notifications` | 200 | OK |   | [student-notifications.jpg](screenshots/desktop/student-notifications.jpg) |
| student-profile | `/student/profile` | 200 | OK |   | [student-profile.jpg](screenshots/desktop/student-profile.jpg) |
| student-clearance | `/student/clearance` | 200 | OK |   | [student-clearance.jpg](screenshots/desktop/student-clearance.jpg) |

## mobile (390×844, 2x, touch)

| Page | URL | HTTP | Result | Problems / notes | Screenshot |
|---|---|---|---|---|---|
| public-home | `/` | 200 | OK | sub-request 404 /hero-library.jpg; console: Failed to load resource: the server responded with a status of 404 (Not Found) | [public-home.jpg](screenshots/mobile/public-home.jpg) |
| public-login | `/login` | 200 | OK |   | [public-login.jpg](screenshots/mobile/public-login.jpg) |
| public-change-password-first | `/change-password?first=1&id=LIB-1001` | 200 | OK |   | [public-change-password-first.jpg](screenshots/mobile/public-change-password-first.jpg) |
| public-catalog | `/catalog` | 404 | FLAGGED | HTTP 404; console: Failed to load resource: the server responded with a status of 404 (Not Found) | [public-catalog.jpg](screenshots/mobile/public-catalog.jpg) |
| public-not-found | `/this-page-does-not-exist` | 404 | OK | console: Failed to load resource: the server responded with a status of 404 (Not Found) | [public-not-found.jpg](screenshots/mobile/public-not-found.jpg) |
| public-privacy-policy | `/privacy-policy` | 200 | OK |   | [public-privacy-policy.jpg](screenshots/mobile/public-privacy-policy.jpg) |
| public-terms | `/terms` | 200 | OK |   | [public-terms.jpg](screenshots/mobile/public-terms.jpg) |
| admin-dashboard | `/admin/dashboard` | 200 | OK |   | [admin-dashboard.jpg](screenshots/mobile/admin-dashboard.jpg) |
| admin-mobile-menu | `/admin/dashboard` | 200 | OK |   | [admin-mobile-menu.jpg](screenshots/mobile/admin-mobile-menu.jpg) |
| admin-issue | `/admin/issue` | 200 | OK |   | [admin-issue.jpg](screenshots/mobile/admin-issue.jpg) |
| admin-issue-student-loaded | `/admin/issue` | 200 | OK |   | [admin-issue-student-loaded.jpg](screenshots/mobile/admin-issue-student-loaded.jpg) |
| admin-return | `/admin/return` | 200 | OK |   | [admin-return.jpg](screenshots/mobile/admin-return.jpg) |
| admin-renewals | `/admin/renewals` | 200 | OK |   | [admin-renewals.jpg](screenshots/mobile/admin-renewals.jpg) |
| admin-reservations | `/admin/reservations` | 200 | OK |   | [admin-reservations.jpg](screenshots/mobile/admin-reservations.jpg) |
| admin-reservations-awaiting-approval | `/admin/reservations?status=AWAITING_APPROVAL` | 200 | OK |   | [admin-reservations-awaiting-approval.jpg](screenshots/mobile/admin-reservations-awaiting-approval.jpg) |
| admin-overdue | `/admin/overdue` | 200 | OK |   | [admin-overdue.jpg](screenshots/mobile/admin-overdue.jpg) |
| admin-fines | `/admin/fines` | 200 | OK |   | [admin-fines.jpg](screenshots/mobile/admin-fines.jpg) |
| admin-lost-damaged | `/admin/lost-damaged` | 200 | OK |   | [admin-lost-damaged.jpg](screenshots/mobile/admin-lost-damaged.jpg) |
| admin-entry-exit | `/admin/entry-exit` | 200 | OK |   | [admin-entry-exit.jpg](screenshots/mobile/admin-entry-exit.jpg) |
| admin-students | `/admin/students` | 200 | OK |   | [admin-students.jpg](screenshots/mobile/admin-students.jpg) |
| admin-student-detail | `/admin/students/STU-2026-1001` | 200 | OK |   | [admin-student-detail.jpg](screenshots/mobile/admin-student-detail.jpg) |
| admin-books | `/admin/books` | 200 | OK |   | [admin-books.jpg](screenshots/mobile/admin-books.jpg) |
| admin-book-detail | `/admin/books/seed-book-dsa` | 200 | OK |   | [admin-book-detail.jpg](screenshots/mobile/admin-book-detail.jpg) |
| admin-book-copies | `/admin/book-copies` | 200 | OK |   | [admin-book-copies.jpg](screenshots/mobile/admin-book-copies.jpg) |
| admin-authors | `/admin/authors` | 200 | OK |   | [admin-authors.jpg](screenshots/mobile/admin-authors.jpg) |
| admin-publishers | `/admin/publishers` | 200 | OK |   | [admin-publishers.jpg](screenshots/mobile/admin-publishers.jpg) |
| admin-categories | `/admin/categories` | 200 | OK |   | [admin-categories.jpg](screenshots/mobile/admin-categories.jpg) |
| admin-subjects | `/admin/subjects` | 200 | OK |   | [admin-subjects.jpg](screenshots/mobile/admin-subjects.jpg) |
| admin-reports | `/admin/reports` | 200 | OK | very tall page (10852px), captured at 1x | [admin-reports.jpg](screenshots/mobile/admin-reports.jpg) |
| admin-settings | `/admin/settings` | 200 | OK |   | [admin-settings.jpg](screenshots/mobile/admin-settings.jpg) |
| admin-staff | `/admin/staff` | 200 | OK |   | [admin-staff.jpg](screenshots/mobile/admin-staff.jpg) |
| admin-audit-logs | `/admin/audit-logs` | 200 | OK |   | [admin-audit-logs.jpg](screenshots/mobile/admin-audit-logs.jpg) |
| student-dashboard | `/student/dashboard` | 200 | OK |   | [student-dashboard.jpg](screenshots/mobile/student-dashboard.jpg) |
| student-books | `/student/books` | 200 | OK |   | [student-books.jpg](screenshots/mobile/student-books.jpg) |
| student-my-books | `/student/my-books` | 200 | OK |   | [student-my-books.jpg](screenshots/mobile/student-my-books.jpg) |
| student-reservations | `/student/reservations` | 200 | OK |   | [student-reservations.jpg](screenshots/mobile/student-reservations.jpg) |
| student-history | `/student/history` | 200 | OK |   | [student-history.jpg](screenshots/mobile/student-history.jpg) |
| student-visits | `/student/visits` | 200 | OK |   | [student-visits.jpg](screenshots/mobile/student-visits.jpg) |
| student-fines | `/student/fines` | 200 | OK |   | [student-fines.jpg](screenshots/mobile/student-fines.jpg) |
| student-notifications | `/student/notifications` | 200 | OK |   | [student-notifications.jpg](screenshots/mobile/student-notifications.jpg) |
| student-profile | `/student/profile` | 200 | OK |   | [student-profile.jpg](screenshots/mobile/student-profile.jpg) |
| student-clearance | `/student/clearance` | 200 | OK |   | [student-clearance.jpg](screenshots/mobile/student-clearance.jpg) |

