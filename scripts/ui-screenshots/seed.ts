/**
 * Demo data for the UI screenshot pipeline (.github/workflows/ui-screenshots.yml).
 *
 * WIPES the target database, then seeds a small but complete college library so every admin
 * and student page renders real content: staff and students, physical copies of the REAL
 * Sanity catalog (read-only, public dataset — never written to), loans that are due soon,
 * overdue and returned, fines in every state, a reservation queue, gate visits, notifications
 * and audit history. All dates are relative to "now" on IST calendar days (like the app), so
 * "today", "due within 3 days" and "overdue" always have rows whenever the pipeline runs.
 * Names, IDs and the shape of the data are the same on every run.
 *
 *   MONGODB_URI=mongodb://127.0.0.1:<port>/library npx tsx scripts/ui-screenshots/seed.ts
 *
 * Env:
 *   MONGODB_URI            throwaway database; anything but localhost is refused unless UI_SEED_ALLOW_REMOTE=1
 *   UI_SEED_IDS_FILE       where to write the logins + ids the capture script needs (default <tmpdir>/ui-seed.json)
 *   UI_SEED_DRY_RUN=1      build and validate every document, print the summary, never touch MongoDB
 *   NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET   catalog to read (default ivm8i99b / production)
 *
 * Logins: admin@demo.local / librarian@demo.local / staff@demo.local with "Admin@12345";
 * every student (LIB-1001 … LIB-1014) with "Student@123". The demo student is Aarav Sharma (LIB-1001).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose, { Types } from "mongoose";
// Relative imports on purpose: tsx doesn't resolve the "@/..." alias, and none of these import it.
import User from "../../models/User";
import Student from "../../models/Student";
import BookCopy from "../../models/BookCopy";
import BorrowTransaction from "../../models/BorrowTransaction";
import Fine from "../../models/Fine";
import Reservation from "../../models/Reservation";
import LibraryVisit from "../../models/LibraryVisit";
import Notification from "../../models/Notification";
import AuditLog from "../../models/AuditLog";
import LibrarySettings from "../../models/LibrarySettings";
import { hashPassword } from "../../lib/auth/password";
import { startOfIstDay, endOfIstDayAfter, istTimeHHmm, formatIstDate } from "../../lib/domain/dates";
import { calculateOverdueDays, calculateFineAmount } from "../../lib/domain/fines";

type Row = Record<string, any>;

/* -------------------------------------------------------------------------- */
/* Fixed demo content                                                          */
/* -------------------------------------------------------------------------- */

const STAFF_PASSWORD = "Admin@12345";
// Deliberately NOT the Library ID: a student whose password still equals their Library or
// Student ID is sent to /change-password?first=1 instead of being signed in.
const STUDENT_PASSWORD = "Student@123";

const SETTINGS = {
  libraryName: "College Central Library",
  libraryEmail: "library@demo.local",
  libraryPhone: "+91 33 4000 1234",
  libraryAddress: "Academic Block C, Ground Floor, Demo College Campus, Kolkata 700091",
  borrowingDurationDays: 7,
  maxBooksPerStudent: 3,
  finePerDay: 5,
  gracePeriodDays: 0,
  allowRenewal: true,
  maxRenewals: 2,
  maxFineAmount: 500,
  reservationHoldDays: 3,
};

type StaffKey = "admin" | "librarian" | "staff";
const STAFF: { key: StaffKey; role: string; name: string; email: string; joinedDaysAgo: number }[] = [
  { key: "admin", role: "SUPER_ADMIN", name: "Neha Kapoor", email: "admin@demo.local", joinedDaysAgo: 420 },
  { key: "librarian", role: "LIBRARIAN", name: "Suresh Pillai", email: "librarian@demo.local", joinedDaysAgo: 300 },
  { key: "staff", role: "LIBRARY_STAFF", name: "Farhan Ahmed", email: "staff@demo.local", joinedDaysAgo: 75 },
];

// Fictional people. Student N gets STU-2026-(1000+N) / LIB-(1000+N); the first is the demo student.
const STUDENTS = [
  { key: "aarav", name: "Aarav Sharma", dept: "Computer Science", code: "CSE", course: "B.Tech", sem: 5, section: "A", phone: "9830041275", status: "ACTIVE" },
  { key: "diya", name: "Diya Patel", dept: "Information Technology", code: "IT", course: "B.Tech", sem: 3, section: "B", phone: "9051123348", status: "ACTIVE" },
  { key: "vihaan", name: "Vihaan Reddy", dept: "Mechanical Engineering", code: "ME", course: "B.Tech", sem: 7, section: "A", phone: "9433207761", status: "ACTIVE" },
  { key: "ananya", name: "Ananya Iyer", dept: "Electronics & Communication", code: "ECE", course: "B.Tech", sem: 5, section: "B", phone: "8697334102", status: "ACTIVE" },
  { key: "arjun", name: "Arjun Nair", dept: "Civil Engineering", code: "CE", course: "B.Tech", sem: 3, section: "A", phone: "9874410956", status: "ACTIVE" },
  { key: "ishita", name: "Ishita Banerjee", dept: "Management", code: "MBA", course: "MBA", sem: 3, section: "A", phone: "9163528847", status: "ACTIVE" },
  { key: "kabir", name: "Kabir Singh", dept: "Electrical Engineering", code: "EE", course: "B.Tech", sem: 5, section: "A", phone: "7003619284", status: "ACTIVE" },
  { key: "meera", name: "Meera Joshi", dept: "Computer Science", code: "CSE", course: "B.Tech", sem: 7, section: "B", phone: "9831772630", status: "ACTIVE" },
  { key: "rohan", name: "Rohan Das", dept: "Information Technology", code: "IT", course: "B.Tech", sem: 5, section: "A", phone: "8910283375", status: "ACTIVE" },
  { key: "saanvi", name: "Saanvi Gupta", dept: "Electronics & Communication", code: "ECE", course: "B.Tech", sem: 3, section: "A", phone: "9007845521", status: "ACTIVE" },
  { key: "aditya", name: "Aditya Kulkarni", dept: "Mechanical Engineering", code: "ME", course: "B.Tech", sem: 5, section: "B", phone: "9748126093", status: "ACTIVE" },
  { key: "priya", name: "Priya Menon", dept: "Civil Engineering", code: "CE", course: "B.Tech", sem: 7, section: "A", phone: "8420967314", status: "ACTIVE" },
  { key: "siddharth", name: "Siddharth Chatterjee", dept: "Electrical Engineering", code: "EE", course: "B.Tech", sem: 3, section: "B", phone: "9339051786", status: "SUSPENDED" },
  { key: "tanvi", name: "Tanvi Mehta", dept: "Management", code: "BBA", course: "BBA", sem: 6, section: "A", phone: "9674238810", status: "GRADUATED" },
] as const;
type StudentKey = (typeof STUDENTS)[number]["key"];
const DEMO_STUDENT: StudentKey = "aarav";

/* -------------------------------------------------------------------------- */
/* Time + deterministic ids                                                    */
/* -------------------------------------------------------------------------- */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const NOW = new Date();
const TODAY = startOfIstDay(NOW); // 00:00 IST today, as an instant

/** HH:mm IST on the IST calendar day `offset` days from today (offset < 0). */
function day(offset: number, hhmm: string): Date {
  if (offset >= 0) throw new Error(`day(${offset}) — use ago() for today`);
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(TODAY.getTime() + offset * DAY + (h * 60 + m) * MINUTE);
}

/** `minutes` before now, clamped so it never slips into yesterday (keeps "today" rows today). */
function ago(minutes: number): Date {
  const floor = TODAY.getTime() + MINUTE;
  return new Date(Math.min(NOW.getTime() - 1000, Math.max(floor, NOW.getTime() - minutes * MINUTE)));
}

const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MINUTE);

// mulberry32 — a fixed seed makes every random-looking suffix identical from run to run.
let prngState = 0x1b7a2c4d;
function rand(): number {
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function hex(length: number): string {
  let out = "";
  while (out.length < length) out += Math.floor(rand() * 16).toString(16);
  return out;
}
/** ObjectId whose timestamp part matches the record's own date. */
function oid(at: Date): Types.ObjectId {
  return new Types.ObjectId(Math.floor(at.getTime() / 1000).toString(16).padStart(8, "0").slice(-8) + hex(16));
}
/** Same shape as lib/domain/ids.ts makeId(): PREFIX-<ms>-<6 hex>. */
const makeId = (prefix: string, at: Date) => `${prefix}-${at.getTime()}-${hex(6)}`;

/* -------------------------------------------------------------------------- */
/* Catalog (Sanity, read-only)                                                 */
/* -------------------------------------------------------------------------- */

type SanityBook = { _id: string; title: string; cover: boolean };

async function fetchSanityBooks(): Promise<SanityBook[]> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "ivm8i99b";
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
  const query = '*[_type=="book"]{_id,title,"cover":defined(coverImage.asset)}';
  const url = `https://${projectId}.apicdn.sanity.io/v2025-01-01/data/query/${dataset}?query=${encodeURIComponent(query)}`;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as { result?: { _id?: string; title?: string | null; cover?: boolean }[] };
      const books = (body.result ?? [])
        .filter((b): b is { _id: string; title?: string | null; cover?: boolean } => typeof b?._id === "string")
        .filter((b) => !b._id.startsWith("drafts.") && !b._id.startsWith("versions."))
        .map((b) => ({ _id: b._id, title: (b.title ?? "").trim() || "(untitled)", cover: Boolean(b.cover) }))
        .sort((a, b) => a.title.localeCompare(b.title, "en") || a._id.localeCompare(b._id));
      if (books.length === 0) throw new Error(`the ${projectId}/${dataset} dataset returned no book documents`);
      return books;
    } catch (err) {
      if (attempt >= 4) throw new Error(`Could not read the Sanity catalog after ${attempt} attempts: ${(err as Error).message}`);
      console.warn(`[seed] Sanity fetch attempt ${attempt} failed (${(err as Error).message}); retrying…`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

/**
 * Copies per title. The two titles every student wants (A, B) get exactly 3 copies, all of them
 * out, so they show "Not available" and carry the reservation queue. Otherwise 2–3 per title;
 * a small catalog gets a few more each so enough copies stay on the shelf after all the loans.
 */
function copiesFor(index: number, total: number): number {
  if (total < 5) return Math.ceil(26 / total);
  if (index < 2) return 3;
  if (total >= 11) return index % 2 === 0 ? 3 : 2;
  return Math.min(5, Math.max(3, Math.ceil(26 / total)));
}

/* -------------------------------------------------------------------------- */
/* Dataset                                                                     */
/* -------------------------------------------------------------------------- */

type CopySlot = { row: Row; book: number; busy: [number, number][] };

function buildDataset(books: SanityBook[], hashes: { staff: string; student: string }) {
  const N = books.length;
  // Title "slots" A..I. They wrap on a small catalog; the allocator then spills to other titles.
  const [A, B, C, D, E, F, G, H, I] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => i % N);

  /* ---- staff ---- */
  const users: Row[] = [];
  const staff = {} as Record<StaffKey, Row>;
  for (const s of STAFF) {
    const joined = day(-s.joinedDaysAgo, "10:00");
    staff[s.key] = {
      _id: oid(joined), role: s.role, email: s.email, passwordHash: hashes.staff, name: s.name,
      status: "ACTIVE", sessionVersion: 0, createdAt: joined, updatedAt: joined,
    };
    users.push(staff[s.key]);
  }

  /* ---- students + their STUDENT user accounts ---- */
  const students: Row[] = [];
  const stu = {} as Record<StudentKey, Row>;
  STUDENTS.forEach((s, i) => {
    const n = 1001 + i;
    // Enrolled at the start of the term; the demo student is the newest, so it tops the list.
    const enrolled = new Date(day(-70, "11:00").getTime() - i * 7 * MINUTE);
    const [first, ...rest] = s.name.toLowerCase().split(" ");
    const email = `${first}.${rest.join("")}@students.demo.local`;
    const admissionYear = 2026 - Math.floor((s.sem - 1) / 2);
    const userId = oid(enrolled);
    const row: Row = {
      _id: oid(enrolled), userId, studentId: `STU-2026-${n}`, libraryId: `LIB-${n}`,
      enrollmentNo: `ENR${admissionYear}${s.code}${String(40 + i).padStart(3, "0")}`,
      name: s.name, email, phone: s.phone, department: s.dept, course: s.course, semester: s.sem,
      section: s.section, academicYear: s.status === "GRADUATED" ? "2025-26" : "2026-27", status: s.status,
      createdAt: enrolled, updatedAt: enrolled,
    };
    if (s.status === "GRADUATED") {
      row.clearanceConfirmedAt = day(-12, "15:30");
      row.clearanceConfirmedBy = staff.librarian._id;
    }
    if (s.status === "SUSPENDED") row.updatedAt = day(-7, "10:20");
    stu[s.key] = row;
    students.push(row);
    users.push({
      _id: userId, role: "STUDENT", email, passwordHash: hashes.student, name: s.name, status: "ACTIVE",
      studentProfile: row._id, sessionVersion: s.key === DEMO_STUDENT ? 1 : 0, createdAt: enrolled,
      updatedAt: s.key === DEMO_STUDENT ? day(-60, "20:14") : enrolled,
    });
  });

  /* ---- physical copies of every Sanity title ---- */
  const copies: CopySlot[] = [];
  const copiesByBook: CopySlot[][] = books.map(() => []);
  let seq = 0;
  books.forEach((book, b) => {
    for (let j = 0; j < copiesFor(b, N); j++) {
      seq++;
      const acquired = day(-(380 + ((b * 53 + j * 29) % 420)), "11:30");
      const slot: CopySlot = {
        book: b,
        busy: [],
        row: {
          _id: oid(acquired),
          copyId: `BK${String(b + 1).padStart(3, "0")}-C${j + 1}`,
          sanityBookId: book._id,
          barcode: `BC-${24000 + seq}`,
          accessionNumber: `ACC-${18000 + seq}`,
          status: "AVAILABLE",
          // Most copies have a shelf location; every 4th doesn't (shows "—" in the tables).
          location: seq % 4 === 0 ? {} : {
            blockId: "Main", floorId: "1", sectionId: "Stacks",
            rackId: `R-${String((b % 12) + 1).padStart(2, "0")}`, shelfId: `S${(j % 5) + 1}`,
          },
          condition: ["Good", "Good", "New", "Fair"][seq % 4],
          acquisitionDate: acquired,
          purchasePrice: 350 + ((b * 97 + j * 13) % 18) * 50,
          createdAt: acquired,
          updatedAt: acquired,
        },
      };
      copies.push(slot);
      copiesByBook[b].push(slot);
    }
  });

  /** A copy of title `pref` (or the next title that has one) that is free over [from, to). */
  function allocate(pref: number, from: Date, to: Date | null, lastCopyFirst = false): CopySlot {
    const start = from.getTime();
    const end = to ? to.getTime() : Infinity;
    for (let step = 0; step < N; step++) {
      const list = copiesByBook[(pref + step) % N];
      for (const slot of lastCopyFirst ? [...list].reverse() : list) {
        if (slot.busy.every(([s, e]) => end <= s || start >= e)) {
          slot.busy.push([start, end]);
          return slot;
        }
      }
    }
    throw new Error(`Not enough book copies: nothing free from ${from.toISOString()} (catalog has ${N} titles)`);
  }

  function setCopyStatus(slot: CopySlot, status: string, since: Date, notes?: string, condition?: string) {
    Object.assign(slot.row, { status, updatedAt: since }, notes ? { notes } : {}, condition ? { condition } : {});
  }

  // The copy of B returned yesterday that is now held for the demo student's READY reservation.
  const holdSlot = allocate(B, day(-8, "10:00"), null);
  // Out of circulation. The last copy of a title, so the first copies stay free for loans.
  const lostSlot = allocate(C, day(-12, "11:00"), null, true);
  setCopyStatus(lostSlot, "LOST", day(-12, "11:00"), "Missing since the stock verification on the 2nd floor; replacement ordered.");
  const damagedSlot = allocate(D, day(-6, "15:00"), null, true);
  setCopyStatus(damagedSlot, "DAMAGED", day(-6, "15:00"), "Returned with water damage, pages 40–62 warped.", "Poor");
  const repairSlot = allocate(E, day(-4, "12:00"), null, true);
  setCopyStatus(repairSlot, "REPAIR", day(-4, "12:00"), "Spine coming loose, sent to the bindery.", "Fair");

  /* ---- loans ---- */
  type Loan = { row: Row; slot: CopySlot; due: Date };
  const transactions: Row[] = [];
  function loan(l: {
    who: StudentKey; book: number; issue: Date; returned?: Date; by: StaffKey; to?: StaffKey;
    renewals?: number; renewedAt?: Date; slot?: CopySlot; busyFrom?: Date;
  }): Loan {
    const slot = l.slot ?? allocate(l.book, l.busyFrom ?? l.issue, l.returned ?? null);
    let due = endOfIstDayAfter(l.issue, SETTINGS.borrowingDurationDays);
    for (let r = 0; r < (l.renewals ?? 0); r++) due = endOfIstDayAfter(due, SETTINGS.borrowingDurationDays);
    const row: Row = {
      _id: oid(l.issue),
      transactionId: makeId("TXN", l.issue),
      studentId: stu[l.who]._id,
      sanityBookId: slot.row.sanityBookId,
      bookCopyId: slot.row._id,
      issueDate: l.issue,
      dueDate: due,
      renewalCount: l.renewals ?? 0,
      issuedBy: staff[l.by]._id,
      status: l.returned ? "RETURNED" : "ACTIVE",
      createdAt: l.issue,
      updatedAt: l.returned ?? l.renewedAt ?? l.issue,
    };
    if (l.returned) {
      row.returnDate = l.returned;
      row.returnedTo = staff[l.to ?? "librarian"]._id;
    } else {
      slot.row.status = "ISSUED";
    }
    transactions.push(row);
    return { row, slot, due };
  }

  // Active. Titles A and B end up with every copy out. Due dates follow the app's rule
  // (end of the IST day, 7 days after issue / after the previous due date on renewal).
  const arjunOverdue = loan({ who: "arjun", book: A, issue: day(-15, "14:30"), by: "librarian" }); // 8 days overdue
  const diyaDueSoon = loan({ who: "diya", book: A, issue: day(-6, "12:10"), by: "staff" }); // due tomorrow
  const ananyaToday = loan({ who: "ananya", book: A, issue: ago(130), by: "librarian" });
  const rohanOverdue = loan({ who: "rohan", book: B, issue: day(-9, "16:20"), by: "staff" }); // 2 days overdue
  const meeraYesterday = loan({ who: "meera", book: B, issue: day(-1, "12:40"), by: "librarian" });
  const aaravDueSoon = loan({ who: "aarav", book: C, issue: day(-5, "11:20"), by: "librarian" }); // due in 2 days
  const aaravLater = loan({ who: "aarav", book: D, issue: day(-2, "15:05"), by: "staff" }); // due in 5 days
  const aaravOverdue = loan({ who: "aarav", book: E, issue: day(-10, "10:45"), by: "librarian" }); // 3 days overdue
  const kabirRenewed = loan({ who: "kabir", book: F, issue: day(-12, "09:55"), renewals: 1, renewedAt: day(-5, "09:40"), by: "librarian" }); // due in 2 days
  loan({ who: "aditya", book: G, issue: day(-3, "10:05"), by: "staff" });
  const ishitaRenewed = loan({ who: "ishita", book: H, issue: day(-9, "11:30"), renewals: 1, renewedAt: day(-2, "16:30"), by: "librarian" });
  const vihaanToday = loan({ who: "vihaan", book: I, issue: ago(55), by: "staff" });

  // Returned — history, reports and the 7-day trend. The saanvi loan picked up her (then
  // FULFILLED) reservation, so its copy was also busy during the day it sat on hold.
  const saanviLate = loan({ who: "saanvi", book: G, busyFrom: day(-15, "16:00"), issue: day(-14, "10:10"), returned: day(-5, "13:00"), by: "librarian", to: "staff" });
  const ananyaReturnedB = loan({ who: "ananya", book: B, slot: holdSlot, issue: day(-8, "10:00"), returned: day(-1, "10:30"), by: "staff", to: "librarian" });
  const aaravLate = loan({ who: "aarav", book: F, issue: day(-26, "09:50"), returned: day(-16, "16:10"), by: "librarian", to: "librarian" });
  const vihaanLate = loan({ who: "vihaan", book: D, issue: day(-45, "14:00"), returned: day(-33, "10:15"), by: "staff", to: "librarian" });
  const ishitaLate = loan({ who: "ishita", book: E, issue: day(-30, "12:20"), returned: day(-20, "11:45"), by: "librarian", to: "staff" });
  const priyaLate = loan({ who: "priya", book: C, issue: day(-24, "09:35"), returned: day(-9, "14:50"), by: "staff", to: "librarian" });
  const rohanLate = loan({ who: "rohan", book: H, issue: day(-17, "15:30"), returned: day(-3, "10:20"), by: "librarian", to: "staff" });
  const saanviToday = loan({ who: "saanvi", book: C, issue: day(-4, "11:00"), returned: ago(35), by: "staff", to: "staff" });
  const adityaToday = loan({ who: "aditya", book: I, issue: ago(190), returned: ago(40), by: "librarian", to: "librarian" });
  loan({ who: "diya", book: D, issue: day(-6, "10:30"), returned: day(-2, "12:10"), by: "staff", to: "librarian" });
  loan({ who: "arjun", book: E, issue: day(-2, "13:15"), returned: day(-1, "11:00"), by: "librarian", to: "staff" });
  loan({ who: "siddharth", book: F, issue: day(-3, "09:40"), returned: day(-1, "16:30"), by: "staff", to: "librarian" });
  loan({ who: "aarav", book: C, issue: day(-58, "10:40"), returned: day(-52, "15:20"), by: "librarian", to: "staff" });
  loan({ who: "aarav", book: D, issue: day(-40, "11:05"), returned: day(-35, "12:30"), by: "staff", to: "librarian" });
  loan({ who: "kabir", book: H, issue: day(-50, "10:00"), returned: day(-44, "15:00"), by: "librarian", to: "librarian" });
  loan({ who: "meera", book: G, issue: day(-36, "12:00"), returned: day(-30, "11:00"), by: "librarian", to: "staff" });
  loan({ who: "diya", book: E, issue: day(-21, "10:45"), returned: day(-15, "09:30"), by: "staff", to: "staff" });
  loan({ who: "saanvi", book: D, issue: day(-33, "11:20"), returned: day(-27, "14:40"), by: "librarian", to: "librarian" });
  // Older history, one or two a month, so the annual chart isn't just the last two months.
  loan({ who: "vihaan", book: C, issue: day(-75, "12:30"), returned: day(-70, "10:10"), by: "librarian", to: "librarian" });
  loan({ who: "kabir", book: E, issue: day(-95, "09:45"), returned: day(-89, "15:30"), by: "librarian", to: "librarian" });
  loan({ who: "priya", book: F, issue: day(-110, "11:15"), returned: day(-104, "13:40"), by: "librarian", to: "librarian" });
  loan({ who: "arjun", book: D, issue: day(-130, "14:05"), returned: day(-124, "11:50"), by: "librarian", to: "librarian" });
  loan({ who: "meera", book: H, issue: day(-150, "10:25"), returned: day(-143, "16:15"), by: "librarian", to: "librarian" });
  loan({ who: "aarav", book: G, issue: day(-170, "12:15"), returned: day(-164, "10:00"), by: "librarian", to: "librarian" });
  loan({ who: "ishita", book: C, issue: day(-200, "15:20"), returned: day(-194, "12:45"), by: "librarian", to: "librarian" });
  loan({ who: "tanvi", book: G, issue: day(-230, "10:50"), returned: day(-225, "14:10"), by: "librarian", to: "librarian" });
  loan({ who: "ananya", book: I, issue: day(-250, "13:35"), returned: day(-244, "11:20"), by: "librarian", to: "librarian" });
  loan({ who: "tanvi", book: E, issue: day(-265, "09:30"), returned: day(-259, "15:45"), by: "librarian", to: "librarian" });

  /* ---- fines (each from a late return, amounts per the library's ₹5/day rule) ---- */
  const fines: Row[] = [];
  function fine(l: Loan, who: StudentKey, fields: Row): Row {
    const overdueDays = calculateOverdueDays(l.due, l.row.returnDate);
    const original = calculateFineAmount(overdueDays, SETTINGS.finePerDay, SETTINGS.maxFineAmount);
    if (original <= 0) throw new Error(`fine() on a loan that wasn't returned late (${l.row.transactionId})`);
    const createdAt: Date = l.row.returnDate;
    const row: Row = {
      _id: oid(createdAt), fineId: makeId("FINE", createdAt), studentId: stu[who]._id, transactionId: l.row._id,
      amount: original, reason: "Overdue return", overdueDays, status: "PENDING", amountPaid: 0, createdAt,
      ...fields,
    };
    // `amount` is the OUTSTANDING balance once part of it has been paid (see models/Fine.ts).
    if (row.status === "PARTIALLY_PAID") row.amount = original - row.amountPaid;
    if (row.status === "PAID") row.amountPaid = original;
    fines.push(row);
    return row;
  }
  const aaravFine = fine(aaravLate, "aarav", {});
  const priyaFine = fine(priyaLate, "priya", { status: "PARTIALLY_PAID", amountPaid: 20, paidAt: day(-8, "11:10"), paymentMethod: "cash", paymentReference: "RCPT-4471" });
  const ishitaFine = fine(ishitaLate, "ishita", { status: "PAID", paidAt: day(-20, "12:05"), paymentMethod: "upi", paymentReference: "UPI 4269 1187 3401" });
  const saanviFine = fine(saanviLate, "saanvi", { status: "WAIVED", waivedBy: staff.admin._id, notes: "Waived: medical certificate submitted for the late return." });
  const rohanFine = fine(rohanLate, "rohan", {});
  fine(vihaanLate, "vihaan", { status: "PAID", paidAt: day(-32, "18:40"), paymentMethod: "razorpay", paymentReference: "pay_Pq7XkT2mLz9Ab1" });

  /* ---- reservations ---- */
  // The READY hold and the AWAITING/PENDING requests should sit on titles with no copy on the
  // shelf (the app only lets students reserve those). With a normal catalog that's A and B.
  const available = (b: number) => copiesByBook[b].filter((c) => c.row.status === "AVAILABLE").length;
  const holds = (who: StudentKey, b: number) =>
    transactions.some((t) => t.status === "ACTIVE" && t.studentId === stu[who]._id && t.sanityBookId === books[b]._id);
  function outOfStockTitle(pref: number, who: StudentKey, avoid: number[] = []): number {
    const order = [...Array(N).keys()].map((i) => (pref + i) % N).filter((b) => !avoid.includes(b) || N === 1);
    return (
      order.find((b) => available(b) === 0 && !holds(who, b)) ??
      order.find((b) => !holds(who, b)) ??
      order[0] ?? pref
    );
  }

  const reservations: Row[] = [];
  function reserve(who: StudentKey, book: number, status: string, requestedAt: Date, fields: Row = {}): Row {
    const row: Row = {
      _id: oid(requestedAt), reservationId: makeId("RES", requestedAt), studentId: stu[who]._id,
      sanityBookId: books[book]._id, status, requestedAt, ...fields,
    };
    reservations.push(row);
    return row;
  }
  const readyAt = plus(ananyaReturnedB.row.returnDate, 5);
  setCopyStatus(holdSlot, "RESERVED", readyAt);
  const aaravReady = reserve("aarav", holdSlot.book, "READY", day(-6, "18:20"), {
    approvedAt: day(-5, "10:10"), approvedBy: staff.librarian._id, bookCopyId: holdSlot.row._id, readyAt,
  });
  const titleA = outOfStockTitle(A, "aarav", [holdSlot.book]);
  reserve("aarav", titleA, "AWAITING_APPROVAL", ago(25));
  reserve("vihaan", outOfStockTitle(B, "vihaan", [titleA]), "AWAITING_APPROVAL", day(-1, "17:45"));
  const ishitaPending = reserve("ishita", outOfStockTitle(A, "ishita"), "PENDING", day(-4, "12:30"), {
    approvedAt: day(-3, "09:15"), approvedBy: staff.staff._id,
  });
  const saanviFulfilled = reserve("saanvi", saanviLate.slot.book, "FULFILLED", day(-20, "10:00"), {
    approvedAt: day(-19, "11:30"), approvedBy: staff.librarian._id, readyAt: day(-15, "16:00"),
    bookCopyId: saanviLate.slot.row._id, fulfilledAt: saanviLate.row.issueDate,
  });
  reserve("diya", C, "CANCELLED", day(-10, "11:00"), { cancelledAt: day(-8, "13:00") });

  /* ---- gate visits ---- */
  const visits: Row[] = [];
  function visit(who: StudentKey, entry: Date, exit?: Date, autoClosed = false) {
    const row: Row = {
      _id: oid(entry), visitId: makeId("VISIT", entry), studentId: stu[who]._id, entryDate: entry,
      entryTime: istTimeHHmm(entry), entryMethod: "barcode-scan", status: exit || autoClosed ? "EXITED" : "INSIDE",
      createdAt: entry,
    };
    if (exit) {
      Object.assign(row, {
        exitDate: exit, exitTime: istTimeHHmm(exit), exitMethod: "barcode-scan",
        durationMinutes: Math.round((exit.getTime() - entry.getTime()) / MINUTE),
      });
    } else if (autoClosed) {
      row.exitMethod = "auto-close (no exit scan)";
    }
    visits.push(row);
  }
  // Inside right now.
  visit("ananya", ago(95));
  visit("priya", ago(50));
  visit("aarav", ago(20));
  // Came and went today.
  visit("meera", ago(240), ago(160));
  visit("aditya", ago(205), ago(38));
  visit("vihaan", ago(150), ago(70));
  visit("saanvi", ago(110), ago(30));
  // Earlier days.
  visit("aarav", day(-1, "16:05"), day(-1, "17:40"));
  visit("diya", day(-1, "09:45"), day(-1, "11:10"));
  visit("arjun", day(-2, "10:00"), day(-2, "12:30"));
  visit("ishita", day(-2, "15:15"), day(-2, "16:05"));
  visit("aarav", day(-3, "10:20"), day(-3, "12:05"));
  visit("kabir", day(-3, "09:05"), day(-3, "10:15"));
  visit("diya", day(-4, "13:00"), day(-4, "14:20"));
  visit("kabir", day(-4, "17:30"), undefined, true);
  visit("rohan", day(-5, "11:40"), day(-5, "13:10"));
  visit("saanvi", day(-5, "14:25"), day(-5, "17:05"));
  visit("aarav", day(-6, "14:10"), day(-6, "15:00"));
  visit("siddharth", day(-7, "10:30"), day(-7, "12:00"));
  visit("vihaan", day(-8, "12:10"), day(-8, "13:00"));
  visit("aarav", day(-9, "11:30"), day(-9, "13:45"));
  visit("meera", day(-10, "09:30"), day(-10, "11:45"));
  visit("priya", day(-12, "15:00"), day(-12, "16:20"));

  /* ---- notifications (same wording the app itself sends) ---- */
  const notifications: Row[] = [];
  function notify(who: StudentKey, type: string, message: string, createdAt: Date, read: boolean, refId?: string) {
    notifications.push({ _id: oid(createdAt), studentId: stu[who]._id, type, message, read, createdAt, ...(refId ? { refId } : {}) });
  }
  const reminder = (l: Loan) => `Reminder: your book (txn ${l.row.transactionId}) is due ${formatIstDate(l.due)}.`;
  const overdueMsg = (l: Loan) => `Overdue: return your book (txn ${l.row.transactionId}), due ${formatIstDate(l.due)}.`;
  const sweepAt = ago(95);
  notify("aarav", "DUE_SOON", reminder(aaravDueSoon), sweepAt, false, aaravDueSoon.row.transactionId);
  notify("aarav", "OVERDUE", overdueMsg(aaravOverdue), sweepAt, false, aaravOverdue.row.transactionId);
  notify("aarav", "RESERVATION_READY", "Your reserved book is ready for pickup at the counter.", plus(readyAt, 1), false);
  notify("aarav", "RESERVATION_APPROVED", "Your book reservation was approved and is now in the queue.", aaravReady.approvedAt, true);
  notify("aarav", "FINE_ISSUED", `A fine of ₹${aaravFine.amount} was recorded for an overdue return.`, plus(aaravFine.createdAt, 1), true);
  notify("aarav", "ANNOUNCEMENT", "Extended hours: the library stays open until 9 PM through the end-semester exams.", day(-2, "09:00"), true);
  notify("diya", "DUE_SOON", reminder(diyaDueSoon), sweepAt, false, diyaDueSoon.row.transactionId);
  notify("kabir", "DUE_SOON", reminder(kabirRenewed), sweepAt, false, kabirRenewed.row.transactionId);
  notify("arjun", "OVERDUE", overdueMsg(arjunOverdue), sweepAt, false, arjunOverdue.row.transactionId);
  notify("rohan", "OVERDUE", overdueMsg(rohanOverdue), sweepAt, false, rohanOverdue.row.transactionId);
  notify("rohan", "FINE_ISSUED", `A fine of ₹${rohanFine.amount} was recorded for an overdue return.`, plus(rohanFine.createdAt, 1), false);
  notify("ishita", "RESERVATION_APPROVED", "Your book reservation was approved and is now in the queue.", ishitaPending.approvedAt, false);
  notify("saanvi", "RESERVATION_READY", "Your reservation was approved and the book is ready for pickup at the counter.", saanviFulfilled.readyAt, true);

  /* ---- audit trail ---- */
  const auditLogs: Row[] = [];
  function audit(by: Row, action: string, entityType: string, entityId: string, timestamp: Date, previousValue?: Row, newValue?: Row) {
    auditLogs.push({
      _id: oid(timestamp), userId: by._id, role: by.role, action, entityType, entityId, timestamp,
      ...(previousValue ? { previousValue } : {}), ...(newValue ? { newValue } : {}),
    });
  }
  const aaravUser = users.find((u) => u._id === stu.aarav.userId)!;
  const txnAudit = (l: Loan, by: StaffKey, at: Date, returned = false) =>
    audit(staff[by], returned ? "BOOK_RETURNED" : "BOOK_ISSUED", "BorrowTransaction", l.row.transactionId, at, undefined,
      returned
        ? { overdueDays: 0, chargeableDays: 0, fineAmount: 0 }
        : { studentId: students.find((s) => s._id === l.row.studentId)!.studentId, barcode: l.slot.row.barcode, dueDate: l.due });
  audit(staff.admin, "STAFF_CREATED", "User", String(staff.staff._id), staff.staff.createdAt, undefined, { name: staff.staff.name, email: staff.staff.email, role: staff.staff.role });
  audit(aaravUser, "PASSWORD_CHANGED", "User", String(aaravUser._id), day(-60, "20:14"));
  audit(staff.admin, "SETTINGS_UPDATED", "LibrarySettings", "singleton", day(-28, "17:05"),
    { borrowingDurationDays: 14, maxBooksPerStudent: 3, finePerDay: 2, gracePeriodDays: 1, maxRenewals: 1, maxFineAmount: 300, allowRenewal: true },
    { borrowingDurationDays: 7, maxBooksPerStudent: 3, finePerDay: 5, gracePeriodDays: 0, maxRenewals: 2, maxFineAmount: 500, allowRenewal: true });
  audit(staff.librarian, "FINE_PAID", "Fine", ishitaFine.fineId, ishitaFine.paidAt, { status: "PENDING", amount: ishitaFine.amount }, { status: "PAID", amount: ishitaFine.amount, paid: ishitaFine.amountPaid, paymentMethod: "upi" });
  audit(staff.librarian, "COPY_LOST", "BookCopy", lostSlot.row.copyId, lostSlot.row.updatedAt, { status: "AVAILABLE" }, { status: "LOST", notes: lostSlot.row.notes });
  audit(staff.librarian, "FINE_PARTIALLY_PAID", "Fine", priyaFine.fineId, priyaFine.paidAt, { status: "PENDING", amount: priyaFine.amount + priyaFine.amountPaid }, { status: "PARTIALLY_PAID", amount: priyaFine.amount, paid: priyaFine.amountPaid, paymentMethod: "cash" });
  audit(staff.admin, "STUDENT_STATUS_CHANGED", "Student", stu.siddharth.studentId, day(-7, "10:20"), { status: "ACTIVE" }, { status: "SUSPENDED" });
  audit(staff.librarian, "COPY_DAMAGED", "BookCopy", damagedSlot.row.copyId, damagedSlot.row.updatedAt, { status: "AVAILABLE" }, { status: "DAMAGED", notes: damagedSlot.row.notes });
  audit(staff.librarian, "BOOK_RENEWED", "BorrowTransaction", kabirRenewed.row.transactionId, day(-5, "09:40"),
    { dueDate: endOfIstDayAfter(kabirRenewed.row.issueDate, 7), renewalCount: 0 }, { newDueDate: kabirRenewed.due, renewalCount: 1 });
  audit(staff.admin, "FINE_WAIVED", "Fine", saanviFine.fineId, day(-4, "11:25"), { status: "PENDING", amount: saanviFine.amount }, { status: "WAIVED", notes: saanviFine.notes });
  audit(staff.librarian, "COPY_REPAIR", "BookCopy", repairSlot.row.copyId, repairSlot.row.updatedAt, { status: "AVAILABLE" }, { status: "REPAIR", notes: repairSlot.row.notes });
  audit(staff.staff, "BOOK_RETURNED", "BorrowTransaction", rohanLate.row.transactionId, rohanLate.row.returnDate, undefined,
    { overdueDays: rohanFine.overdueDays, chargeableDays: rohanFine.overdueDays, fineAmount: rohanFine.amount });
  audit(staff.librarian, "BOOK_RENEWED", "BorrowTransaction", ishitaRenewed.row.transactionId, day(-2, "16:30"),
    { dueDate: endOfIstDayAfter(ishitaRenewed.row.issueDate, 7), renewalCount: 0 }, { newDueDate: ishitaRenewed.due, renewalCount: 1 });
  txnAudit(ananyaReturnedB, "librarian", ananyaReturnedB.row.returnDate, true);
  txnAudit(meeraYesterday, "librarian", meeraYesterday.row.issueDate);
  txnAudit(ananyaToday, "librarian", ananyaToday.row.issueDate);
  txnAudit(adityaToday, "librarian", adityaToday.row.returnDate, true);
  txnAudit(vihaanToday, "staff", vihaanToday.row.issueDate);
  txnAudit(saanviToday, "staff", saanviToday.row.returnDate, true);

  const settings: Row = { _id: oid(day(-400, "09:00")), ...SETTINGS, updatedAt: day(-28, "17:05") };

  /* ---- the detail pages to capture ---- */
  // The title whose copies show the most different states (ties: has a cover, then first).
  const statusVariety = (b: number) => new Set(copiesByBook[b].map((c) => c.row.status)).size;
  const detailBook = [...Array(N).keys()].sort(
    (x, y) => statusVariety(y) - statusVariety(x) || Number(books[y].cover) - Number(books[x].cover) || x - y
  )[0];

  return {
    books, users, students, settings, copies: copies.map((c) => c.row), transactions, fines, reservations,
    visits, notifications, auditLogs,
    detailBook: books[detailBook],
    demo: stu[DEMO_STUDENT],
  };
}

type Dataset = ReturnType<typeof buildDataset>;

/* -------------------------------------------------------------------------- */
/* Checks                                                                      */
/* -------------------------------------------------------------------------- */

function assertConsistent(ds: Dataset) {
  const problems: string[] = [];
  const unique = (label: string, values: unknown[]) => {
    const seen = new Set<string>();
    for (const v of values.map(String)) {
      if (seen.has(v)) problems.push(`duplicate ${label}: ${v}`);
      seen.add(v);
    }
  };
  unique("user email", ds.users.map((u) => u.email));
  unique("studentId", ds.students.map((s) => s.studentId));
  unique("libraryId", ds.students.map((s) => s.libraryId));
  unique("copyId", ds.copies.map((c) => c.copyId));
  unique("barcode", ds.copies.map((c) => c.barcode));
  unique("accessionNumber", ds.copies.map((c) => c.accessionNumber));
  for (const [label, rows, key] of [
    ["transactionId", ds.transactions, "transactionId"], ["fineId", ds.fines, "fineId"],
    ["reservationId", ds.reservations, "reservationId"], ["visitId", ds.visits, "visitId"],
  ] as const) unique(label, rows.map((r: Row) => r[key]));

  const active = ds.transactions.filter((t) => t.status === "ACTIVE");
  unique("active loan per copy", active.map((t) => t.bookCopyId));
  unique("open visit per student", ds.visits.filter((v) => v.status === "INSIDE").map((v) => v.studentId));
  const issued = new Set(ds.copies.filter((c) => c.status === "ISSUED").map((c) => String(c._id)));
  const onLoan = new Set(active.map((t) => String(t.bookCopyId)));
  if ([...issued].some((id) => !onLoan.has(id)) || [...onLoan].some((id) => !issued.has(id))) {
    problems.push("ISSUED copies don't match ACTIVE loans one-to-one");
  }
  const reserved = new Set(ds.copies.filter((c) => c.status === "RESERVED").map((c) => String(c._id)));
  const held = new Set(ds.reservations.filter((r) => r.status === "READY").map((r) => String(r.bookCopyId)));
  if (reserved.size !== held.size || [...reserved].some((id) => !held.has(id))) {
    problems.push("RESERVED copies don't match READY reservations one-to-one");
  }
  const perStudent = new Map<string, number>();
  for (const t of active) perStudent.set(String(t.studentId), (perStudent.get(String(t.studentId)) ?? 0) + 1);
  for (const [id, n] of perStudent) {
    if (n > SETTINGS.maxBooksPerStudent) problems.push(`student ${id} has ${n} active loans (> ${SETTINGS.maxBooksPerStudent})`);
  }
  for (const t of ds.transactions) {
    if (t.issueDate > NOW || (t.returnDate && (t.returnDate > NOW || t.returnDate < t.issueDate))) {
      problems.push(`impossible dates on ${t.transactionId}`);
    }
  }
  if (problems.length) throw new Error(`Seed data is inconsistent:\n  - ${problems.join("\n  - ")}`);
}

/** What the app will show — computed the way the app computes it. */
function summarize(ds: Dataset) {
  const count = <T extends Row>(rows: T[], key: string) =>
    rows.reduce<Record<string, number>>((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {});
  const now = Date.now();
  const active = ds.transactions.filter((t) => t.status === "ACTIVE");
  return {
    catalogTitles: ds.books.length,
    copies: ds.copies.length,
    copiesByStatus: count(ds.copies, "status"),
    students: ds.students.length,
    staff: ds.users.length - ds.students.length,
    loans: {
      active: active.length,
      overdue: active.filter((t) => t.dueDate.getTime() < now).length,
      dueWithin3Days: active.filter((t) => t.dueDate.getTime() >= now && t.dueDate.getTime() <= now + 3 * 86_400_000).length,
      returned: ds.transactions.length - active.length,
      issuedToday: ds.transactions.filter((t) => t.issueDate >= TODAY).length,
    },
    finesByStatus: count(ds.fines, "status"),
    pendingFineTotal: ds.fines.filter((f) => ["PENDING", "PARTIALLY_PAID"].includes(f.status)).reduce((s, f) => s + f.amount, 0),
    reservationsByStatus: count(ds.reservations, "status"),
    visits: { total: ds.visits.length, insideNow: ds.visits.filter((v) => v.status === "INSIDE").length },
    notifications: ds.notifications.length,
    auditLogs: ds.auditLogs.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

/** Validates a planned row against the app's own Mongoose schema and returns the exact document to insert. */
function materialize(M: mongoose.Model<any>, row: Row): Row {
  const doc = new M(row);
  const err = doc.validateSync();
  if (err) throw new Error(`${M.modelName} failed schema validation: ${err.message}\n${JSON.stringify(row).slice(0, 600)}`);
  const out = doc.toObject({ depopulate: true }) as Row;
  // Inserted with the raw driver so the planned timestamps survive (Mongoose would stamp "now").
  for (const key of ["createdAt", "updatedAt"]) if (row[key] !== undefined) out[key] = row[key];
  out.__v = 0;
  return out;
}

function assertThrowawayDatabase(uri: string) {
  if (process.env.UI_SEED_ALLOW_REMOTE === "1") return;
  const m = uri.match(/^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/);
  const hosts = m && !m[1] ? m[2].split(",").map((h) => h.replace(/:\d+$/, "").replace(/^\[|\]$/g, "")) : [];
  if (hosts.length === 0 || !hosts.every((h) => ["localhost", "127.0.0.1", "::1"].includes(h))) {
    throw new Error(
      "Refusing to seed: this script DROPS the whole database and MONGODB_URI is not a local throwaway instance. " +
        "Set UI_SEED_ALLOW_REMOTE=1 if you really mean it."
    );
  }
}

const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

async function main() {
  const dryRun = process.env.UI_SEED_DRY_RUN === "1";
  const uri = process.env.MONGODB_URI ?? "";
  if (!dryRun) {
    if (!uri) throw new Error("MONGODB_URI is not set");
    assertThrowawayDatabase(uri);
  }

  console.log(`[seed] now = ${NOW.toISOString()} (IST day starts ${TODAY.toISOString()})`);
  const books = await fetchSanityBooks();
  console.log(`[seed] Sanity catalog: ${books.length} book(s): ${books.slice(0, 12).map((b) => b.title).join(" · ")}${books.length > 12 ? " · …" : ""}`);

  const [staffHash, studentHash] = await Promise.all([hashPassword(STAFF_PASSWORD), hashPassword(STUDENT_PASSWORD)]);
  const ds = buildDataset(books, { staff: staffHash, student: studentHash });
  assertConsistent(ds);

  const plan: [mongoose.Model<any>, Row[]][] = [
    [User, ds.users],
    [Student, ds.students],
    [LibrarySettings, [ds.settings]],
    [BookCopy, ds.copies],
    [BorrowTransaction, ds.transactions],
    [Fine, ds.fines],
    [Reservation, ds.reservations],
    [LibraryVisit, ds.visits],
    [Notification, ds.notifications],
    [AuditLog, ds.auditLogs],
  ];
  const docs = plan.map(([M, rows]) => [M, rows.map((r) => materialize(M, r))] as const);
  const summary = summarize(ds);

  if (!dryRun) {
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 20_000 });
    try {
      await Promise.all(plan.map(([M]) => M.init()));
      await mongoose.connection.dropDatabase();
      // The app's unique/partial indexes (one active loan per copy, one open visit per student…)
      // go in first, so a mistake in this seed fails loudly here instead of producing odd screens.
      for (const [M] of plan) await M.createIndexes();
      for (const [M, rows] of docs) if (rows.length) await M.collection.insertMany(rows as any[], { ordered: true });

      const now = new Date();
      const dbView = {
        available: await BookCopy.countDocuments({ status: "AVAILABLE" }),
        issued: await BookCopy.countDocuments({ status: "ISSUED" }),
        overdue: await BorrowTransaction.countDocuments({ status: "ACTIVE", dueDate: { $lt: now } }),
        dueSoon: await BorrowTransaction.countDocuments({ status: "ACTIVE", dueDate: { $gte: now, $lte: new Date(now.getTime() + 3 * 86_400_000) } }),
        insideToday: await LibraryVisit.countDocuments({ status: "INSIDE", entryDate: { $gte: startOfIstDay(now) } }),
        awaitingApproval: await Reservation.countDocuments({ status: "AWAITING_APPROVAL" }),
      };
      console.log("[seed] read back from MongoDB:", JSON.stringify(dbView));
      if (dbView.overdue !== summary.loans.overdue || dbView.dueSoon !== summary.loans.dueWithin3Days) {
        console.warn("[seed] warning: overdue/due-soon counts read back differ from the plan (clock edge?)");
      }
    } finally {
      await mongoose.disconnect();
    }
  }

  const idsFile = process.env.UI_SEED_IDS_FILE || path.join(os.tmpdir(), "ui-seed.json");
  const ids = {
    generatedAt: NOW.toISOString(),
    dryRun,
    logins: {
      admin: { email: "admin@demo.local", password: STAFF_PASSWORD, name: STAFF[0].name, role: "SUPER_ADMIN" },
      librarian: { email: "librarian@demo.local", password: STAFF_PASSWORD, name: STAFF[1].name, role: "LIBRARIAN" },
      staff: { email: "staff@demo.local", password: STAFF_PASSWORD, name: STAFF[2].name, role: "LIBRARY_STAFF" },
    },
    demoStudent: {
      name: ds.demo.name, studentId: ds.demo.studentId, libraryId: ds.demo.libraryId, password: STUDENT_PASSWORD,
    },
    book: { id: ds.detailBook._id, title: ds.detailBook.title },
    summary,
  };
  fs.mkdirSync(path.dirname(idsFile), { recursive: true });
  fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2));

  const lines = [
    `${dryRun ? "DRY RUN (nothing written)" : "Seeded"}: ${summary.catalogTitles} Sanity titles, ${summary.copies} copies ${JSON.stringify(summary.copiesByStatus)}`,
    `loans: ${JSON.stringify(summary.loans)}`,
    `fines: ${JSON.stringify(summary.finesByStatus)} (outstanding ₹${summary.pendingFineTotal}); reservations: ${JSON.stringify(summary.reservationsByStatus)}`,
    `visits: ${JSON.stringify(summary.visits)}; notifications: ${summary.notifications}; audit logs: ${summary.auditLogs}; students: ${summary.students}; staff: ${summary.staff}`,
    `demo student ${ids.demoStudent.name} ${ids.demoStudent.libraryId} / ${STUDENT_PASSWORD}; admin ${ids.logins.admin.email} / ${STAFF_PASSWORD}; book detail: ${ids.book.title} (${ids.book.id})`,
    `ids written to ${idsFile}`,
  ];
  for (const line of lines) console.log(`[seed] ${line}`);
  if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice title=Seed summary::${esc(lines.slice(0, 5).join("\n"))}`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
