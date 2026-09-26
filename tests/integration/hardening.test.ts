/**
 * End-to-end checks of the security / race-condition / queue fixes against a REAL MongoDB
 * replica set (transactions, partial unique indexes, $lookup pipelines, $unionWith are all
 * executed for real — nothing here mocks the database).
 *
 * Only the network-bound Sanity client and Next's revalidation cache are stubbed.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/lib/sanity/client", () => ({
  sanityReadClient: { fetch: vi.fn(async () => null) },
  sanityWriteClient: {},
}));
vi.mock("@/lib/sanity/queries", () => ({ bookTitleByIdQuery: "*[_id == $id][0]" }));

import mongoose from "mongoose";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createSession, getSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { endOfIstDayAfter } from "@/lib/domain/dates";
import { issueBook, returnBook, renewBook } from "@/lib/actions/transactions";
import {
  reserveBookAction,
  reserveForStudentAction,
  approveReservationAction,
  cancelReservationAction,
  listOwnReservations,
} from "@/lib/actions/reservations";
import { payFineAction, waiveFineAction } from "@/lib/actions/fines";
import { updateSettingsAction } from "@/lib/actions/settings";
import { scanEntryExitAction, listVisitsForStudent } from "@/lib/actions/visits";
import { getStudentDetail, getClearanceStatus } from "@/lib/actions/students";
import { login, changePassword } from "@/lib/actions/auth";
import { markLostOrDamagedAction, getBookCopyLookupAction } from "@/lib/actions/bookCopies";
import {
  getClearanceReport,
  getStudentReport,
  getDepartmentWiseBorrowing,
  getMostActiveStudents,
  getFineCollectionSummary,
} from "@/lib/actions/reports";
import { getDashboardStats, getIssuesTrend } from "@/lib/actions/dashboard";
import { runDueSoonSweepCore } from "@/lib/notifications/sweep";
import { POST as razorpayWebhook } from "@/app/api/webhooks/razorpay/route";
import { GET as dueSoonCron } from "@/app/api/cron/due-soon/route";
import User from "@/models/User";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import LibrarySettings from "@/models/LibrarySettings";
import Reservation from "@/models/Reservation";
import Notification from "@/models/Notification";
import LibraryVisit from "@/models/LibraryVisit";

const DAY = 24 * 60 * 60 * 1000;
const BASE_SETTINGS = {
  borrowingDurationDays: 7,
  maxBooksPerStudent: 3,
  finePerDay: 5,
  maxFineAmount: 500,
  maxRenewals: 2,
  allowRenewal: true,
  gracePeriodDays: 0,
  reservationHoldDays: 3,
};

let seq = 0;
/** Unique, "_"-free ids so tests never collide with each other or the other test file. */
const uid = (prefix: string) => `${prefix}-${++seq}-${Math.random().toString(36).slice(2, 7)}`;

type Staff = { _id: mongoose.Types.ObjectId; name: string; role: string };
async function asStaff(user: Staff) {
  await createSession({ userId: user._id.toString(), role: user.role as any, name: user.name });
}
async function staff(role: "LIBRARIAN" | "SUPER_ADMIN" | "LIBRARY_STAFF" = "LIBRARIAN"): Promise<Staff> {
  const user: any = await User.create({
    role,
    email: `${uid("staff")}@test.local`,
    passwordHash: "not-used",
    name: `Test ${role}`,
    status: "ACTIVE",
  });
  await asStaff(user);
  return user;
}

type TestStudent = { user: any; student: any; studentId: string; libraryId: string; email: string };
async function makeStudent(opts: { password?: string; defaultPassword?: boolean } = {}): Promise<TestStudent> {
  const studentId = uid("STU");
  const libraryId = uid("LIB");
  const email = `${studentId}@test.local`.toLowerCase();
  const plain = opts.defaultPassword ? libraryId : opts.password;
  const user: any = await User.create({
    role: "STUDENT",
    email,
    passwordHash: plain ? await hashPassword(plain) : "not-used",
    name: `Student ${studentId}`,
    status: "ACTIVE",
  });
  const student: any = await Student.create({
    userId: user._id,
    studentId,
    libraryId,
    enrollmentNo: "ENR1",
    name: `Student ${studentId}`,
    email,
    phone: "9876543210",
    department: "Computer Science",
    course: "B.Tech",
    semester: 3,
    academicYear: "2026-27",
  });
  return { user, student, studentId, libraryId, email };
}
async function asStudent(s: TestStudent) {
  await createSession({ userId: s.user._id.toString(), role: "STUDENT", name: s.user.name, studentId: s.studentId });
}

async function makeCopy(sanityBookId: string, status = "AVAILABLE"): Promise<any> {
  const code = uid("BC");
  return BookCopy.create({
    copyId: code,
    sanityBookId,
    barcode: code,
    accessionNumber: `ACC-${code}`,
    acquisitionDate: new Date(),
    status,
  });
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

/** Server actions end with redirect(); Next signals that by throwing NEXT_REDIRECT. Returns the target URL. */
async function redirectTarget(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err: any) {
    const digest = String(err?.digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw err;
  }
  throw new Error("Expected a redirect, but the action returned normally");
}

const fulfilled = (rs: PromiseSettledResult<unknown>[]) => rs.filter((r) => r.status === "fulfilled");
const rejected = (rs: PromiseSettledResult<unknown>[]) =>
  rs.filter((r): r is PromiseRejectedResult => r.status === "rejected");

describe("hardening fixes on a real MongoDB", () => {
  beforeAll(async () => {
    await connectToDatabase();
    // Build indexes (incl. the partial unique "one active loan per copy" / "one open visit
    // per student" backstops) before any race test runs.
    await Promise.all([BorrowTransaction.init(), LibraryVisit.init(), Reservation.init(), Notification.init(), Fine.init()]);
    await LibrarySettings.deleteMany({});
    await LibrarySettings.create(BASE_SETTINGS);
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_integration_test";
    process.env.CRON_SECRET = "cron_integration_test";
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ---------------------------------------------------------------- issue / return / renew
  describe("issue, return and renew", () => {
    it("two counters issuing the same copy at the same moment: exactly one succeeds", async () => {
      await staff();
      const a = await makeStudent();
      const b = await makeStudent();
      const copy = await makeCopy(uid("book"));

      const results = await Promise.allSettled([
        issueBook({ studentId: a.studentId, barcode: copy.barcode }),
        issueBook({ studentId: b.studentId, barcode: copy.barcode }),
      ]);

      expect(fulfilled(results)).toHaveLength(1);
      expect(String(rejected(results)[0].reason?.message)).toMatch(/already issued|just issued/i);
      expect(await BorrowTransaction.countDocuments({ bookCopyId: copy._id, status: "ACTIVE" })).toBe(1);
      expect((await BookCopy.findById(copy._id))!.status).toBe("ISSUED");
    });

    it("the borrow limit holds when two books are issued to one student at the same moment", async () => {
      await staff();
      const s = await makeStudent();
      const copies = await Promise.all([1, 2, 3, 4].map(() => makeCopy(uid("book"))));
      await issueBook({ studentId: s.studentId, barcode: copies[0].barcode });
      await issueBook({ studentId: s.studentId, barcode: copies[1].barcode });

      const results = await Promise.allSettled([
        issueBook({ studentId: s.studentId, barcode: copies[2].barcode }),
        issueBook({ studentId: s.studentId, barcode: copies[3].barcode }),
      ]);

      expect(fulfilled(results)).toHaveLength(1);
      expect(String(rejected(results)[0].reason?.message)).toMatch(/maximum borrowing limit/i);
      expect(await BorrowTransaction.countDocuments({ studentId: s.student._id, status: "ACTIVE" })).toBe(3);
    });

    it("a double return closes the loan once and creates exactly one fine", async () => {
      await staff();
      const s = await makeStudent();
      const copy = await makeCopy(uid("book"));
      const { transactionId } = await issueBook({ studentId: s.studentId, barcode: copy.barcode });
      await BorrowTransaction.updateOne({ transactionId }, { $set: { dueDate: new Date(Date.now() - 2 * DAY + 60_000) } });

      const results = await Promise.allSettled([returnBook({ barcode: copy.barcode }), returnBook({ barcode: copy.barcode })]);

      expect(fulfilled(results)).toHaveLength(1);
      const txn = await BorrowTransaction.findOne({ transactionId });
      expect(txn!.status).toBe("RETURNED");
      expect(await Fine.countDocuments({ transactionId: txn!._id })).toBe(1);
      expect((await Fine.findOne({ transactionId: txn!._id }))!.amount).toBe(10); // 2 days × ₹5
      expect((await BookCopy.findById(copy._id))!.status).toBe("AVAILABLE");
    });

    it("due dates fall at the very end of the IST day, N days out", async () => {
      await staff();
      const s = await makeStudent();
      const copy = await makeCopy(uid("book"));
      const before = endOfIstDayAfter(new Date(), 7).getTime();
      const { dueDate } = await issueBook({ studentId: s.studentId, barcode: copy.barcode });
      const after = endOfIstDayAfter(new Date(), 7).getTime();

      expect(dueDate.toISOString().endsWith("T18:29:59.999Z")).toBe(true); // 23:59:59.999 IST
      expect([before, after]).toContain(dueDate.getTime());
    });

    it("a partially paid fine still blocks borrowing", async () => {
      await staff();
      const s = await makeStudent();
      await Fine.create({
        fineId: uid("FINE"),
        studentId: s.student._id,
        transactionId: new mongoose.Types.ObjectId(),
        amount: 40,
        reason: "Overdue return",
        status: "PARTIALLY_PAID",
      });
      const copy = await makeCopy(uid("book"));
      await expect(issueBook({ studentId: s.studentId, barcode: copy.barcode })).rejects.toThrow(/outstanding fine/i);
    });

    it("applies the grace period: late within grace is free, beyond it only the extra days are charged", async () => {
      await LibrarySettings.updateMany({}, { $set: { gracePeriodDays: 2 } });
      try {
        await staff();
        const s = await makeStudent();
        const c1 = await makeCopy(uid("book"));
        const c2 = await makeCopy(uid("book"));

        const t1 = await issueBook({ studentId: s.studentId, barcode: c1.barcode });
        await BorrowTransaction.updateOne({ transactionId: t1.transactionId }, { $set: { dueDate: new Date(Date.now() - DAY + 60_000) } });
        const r1 = await returnBook({ barcode: c1.barcode });
        expect(r1.overdueDays).toBe(1);
        expect(r1.fineAmount).toBe(0);

        const t2 = await issueBook({ studentId: s.studentId, barcode: c2.barcode });
        await BorrowTransaction.updateOne({ transactionId: t2.transactionId }, { $set: { dueDate: new Date(Date.now() - 3 * DAY + 60_000) } });
        const r2 = await returnBook({ barcode: c2.barcode });
        expect(r2.overdueDays).toBe(3);
        expect(r2.fineAmount).toBe(5); // (3 - 2 grace) × ₹5
      } finally {
        await LibrarySettings.updateMany({}, { $set: { gracePeriodDays: 0 } });
      }
    });

    it("renewal is refused while someone is waiting or once overdue, and otherwise extends by the loan period", async () => {
      await staff();
      const s = await makeStudent();
      const waiting = await makeStudent();
      const book = uid("book");
      const copy = await makeCopy(book);
      const { transactionId, dueDate } = await issueBook({ studentId: s.studentId, barcode: copy.barcode });

      await Reservation.create({ reservationId: uid("RES"), studentId: waiting.student._id, sanityBookId: book, status: "PENDING" });
      await expect(renewBook({ transactionId })).rejects.toThrow(/waiting/i);

      await Reservation.updateMany({ sanityBookId: book }, { $set: { status: "CANCELLED" } });
      const renewed = await renewBook({ transactionId });
      expect(renewed.renewalCount).toBe(1);
      expect(renewed.dueDate.getTime()).toBe(dueDate.getTime() + 7 * DAY);

      await BorrowTransaction.updateOne({ transactionId }, { $set: { dueDate: new Date(Date.now() - DAY) } });
      await expect(renewBook({ transactionId })).rejects.toThrow(/overdue/i);
    });
  });

  // ---------------------------------------------------------------- reservation queue
  describe("reservation queue", () => {
    it("a student's own request waits for approval, isn't handed a returned copy, and approval holds a free copy at once", async () => {
      const librarian = await staff();
      const holder = await makeStudent();
      const requester = await makeStudent();
      const book = uid("book");
      const copy = await makeCopy(book);
      await issueBook({ studentId: holder.studentId, barcode: copy.barcode });

      await asStudent(requester);
      expect(await redirectTarget(reserveBookAction(form({ studentId: requester.studentId, sanityBookId: book })))).toBe(
        "/student/reservations?success=1"
      );
      const request = await Reservation.findOne({ studentId: requester.student._id, sanityBookId: book });
      expect(request!.status).toBe("AWAITING_APPROVAL");

      await asStaff(librarian);
      await returnBook({ barcode: copy.barcode });
      expect((await BookCopy.findById(copy._id))!.status).toBe("AVAILABLE");
      expect((await Reservation.findById(request!._id))!.status).toBe("AWAITING_APPROVAL");

      await approveReservationAction(form({ reservationId: request!.reservationId }));
      const approved = await Reservation.findById(request!._id);
      expect(approved!.status).toBe("READY");
      expect(approved!.bookCopyId!.toString()).toBe(copy._id.toString());
      expect((await BookCopy.findById(copy._id))!.status).toBe("RESERVED");
      expect(await Notification.countDocuments({ studentId: requester.student._id, type: "RESERVATION_READY" })).toBe(1);
    });

    it("a returned copy goes to the first in line; cancelling that hold passes the copy to the next student", async () => {
      await staff();
      const holder = await makeStudent();
      const first = await makeStudent();
      const second = await makeStudent();
      const book = uid("book");
      const copy = await makeCopy(book);
      await issueBook({ studentId: holder.studentId, barcode: copy.barcode });

      expect(await reserveForStudentAction(first.studentId, book)).toEqual({ success: true });
      await new Promise((r) => setTimeout(r, 10));
      expect(await reserveForStudentAction(second.studentId, book)).toEqual({ success: true });

      await returnBook({ barcode: copy.barcode });
      const r1 = await Reservation.findOne({ studentId: first.student._id, sanityBookId: book });
      expect(r1!.status).toBe("READY");
      expect((await BookCopy.findById(copy._id))!.status).toBe("RESERVED");
      await expect(issueBook({ studentId: second.studentId, barcode: copy.barcode })).rejects.toThrow(/held for another/i);

      await cancelReservationAction(form({ reservationId: r1!.reservationId }));
      expect((await Reservation.findById(r1!._id))!.status).toBe("CANCELLED");
      const r2 = await Reservation.findOne({ studentId: second.student._id, sanityBookId: book });
      expect(r2!.status).toBe("READY");
      expect(r2!.bookCopyId!.toString()).toBe(copy._id.toString());

      await issueBook({ studentId: second.studentId, barcode: copy.barcode });
      expect((await Reservation.findById(r2!._id))!.status).toBe("FULFILLED");
    });

    it("issuing a student a different copy releases their held copy to the next student", async () => {
      await staff();
      const holder = await makeStudent();
      const first = await makeStudent();
      const second = await makeStudent();
      const book = uid("book");
      const heldCopy = await makeCopy(book);
      await issueBook({ studentId: holder.studentId, barcode: heldCopy.barcode });
      await reserveForStudentAction(first.studentId, book);
      await new Promise((r) => setTimeout(r, 10));
      await reserveForStudentAction(second.studentId, book);
      await returnBook({ barcode: heldCopy.barcode }); // first → READY on heldCopy

      const newCopy = await makeCopy(book); // a new copy arrives
      await issueBook({ studentId: first.studentId, barcode: newCopy.barcode });

      expect((await Reservation.findOne({ studentId: first.student._id, sanityBookId: book }))!.status).toBe("FULFILLED");
      const r2 = await Reservation.findOne({ studentId: second.student._id, sanityBookId: book });
      expect(r2!.status).toBe("READY");
      expect(r2!.bookCopyId!.toString()).toBe(heldCopy._id.toString());
      expect((await BookCopy.findById(heldCopy._id))!.status).toBe("RESERVED");
      expect((await BookCopy.findById(newCopy._id))!.status).toBe("ISSUED");
      expect(await Notification.countDocuments({ studentId: second.student._id, type: "RESERVATION_READY" })).toBe(1);
    });

    it("issuing a title closes the student's own pending request for it", async () => {
      await staff();
      const s = await makeStudent();
      const book = uid("book");
      const request = await Reservation.create({
        reservationId: uid("RES"),
        studentId: s.student._id,
        sanityBookId: book,
        status: "AWAITING_APPROVAL",
      });
      const copy = await makeCopy(book);
      await issueBook({ studentId: s.studentId, barcode: copy.barcode });
      expect((await Reservation.findById(request._id))!.status).toBe("FULFILLED");
    });

    it("an uncollected READY hold expires in the daily sweep and moves to the next student", async () => {
      const first = await makeStudent();
      const second = await makeStudent();
      const book = uid("book");
      const copy = await makeCopy(book, "RESERVED");
      const stale = await Reservation.create({
        reservationId: uid("RES"),
        studentId: first.student._id,
        sanityBookId: book,
        status: "READY",
        bookCopyId: copy._id,
        requestedAt: new Date(Date.now() - 10 * DAY),
        readyAt: new Date(Date.now() - 5 * DAY),
      });
      const next = await Reservation.create({
        reservationId: uid("RES"),
        studentId: second.student._id,
        sanityBookId: book,
        status: "PENDING",
        requestedAt: new Date(Date.now() - 9 * DAY),
      });

      const result = await runDueSoonSweepCore();
      expect(result.expiredHolds).toBeGreaterThanOrEqual(1);
      expect((await Reservation.findById(stale._id))!.status).toBe("EXPIRED");
      const moved = await Reservation.findById(next._id);
      expect(moved!.status).toBe("READY");
      expect(moved!.bookCopyId!.toString()).toBe(copy._id.toString());
      expect(await Notification.countDocuments({ studentId: first.student._id, type: "RESERVATION_EXPIRED" })).toBe(1);
      expect(await Notification.countDocuments({ studentId: second.student._id, type: "RESERVATION_READY" })).toBe(1);
    });

    it("marking a held copy lost re-queues the hold; restoring the copy gives it back to that student", async () => {
      await staff();
      const s = await makeStudent();
      const book = uid("book");
      const copy = await makeCopy(book, "RESERVED");
      const hold = await Reservation.create({
        reservationId: uid("RES"),
        studentId: s.student._id,
        sanityBookId: book,
        status: "READY",
        bookCopyId: copy._id,
        readyAt: new Date(),
      });

      expect(await redirectTarget(markLostOrDamagedAction(form({ barcode: copy.barcode, status: "LOST" })))).toBe("/admin/lost-damaged");
      expect((await BookCopy.findById(copy._id))!.status).toBe("LOST");
      const requeued = await Reservation.findById(hold._id);
      expect(requeued!.status).toBe("PENDING");
      expect(requeued!.bookCopyId).toBeUndefined();

      expect(await redirectTarget(markLostOrDamagedAction(form({ barcode: copy.barcode, status: "AVAILABLE" })))).toBe(
        "/admin/lost-damaged"
      );
      const restored = await Reservation.findById(hold._id);
      expect(restored!.status).toBe("READY");
      expect((await BookCopy.findById(copy._id))!.status).toBe("RESERVED");
    });

    it("Quick Issue lookup only offers Reserve when no other copy of the title is on the shelf", async () => {
      await staff();
      const holder = await makeStudent();
      const other = await makeStudent();
      const s = await makeStudent();
      const book = uid("book");
      const c1 = await makeCopy(book);
      const c2 = await makeCopy(book);
      await issueBook({ studentId: holder.studentId, barcode: c1.barcode });

      const withSpare = await getBookCopyLookupAction(c1.barcode, s.studentId);
      expect(withSpare!.canReserve).toBe(false);
      expect(withSpare!.otherCopyAvailable).toBe(true);

      await issueBook({ studentId: other.studentId, barcode: c2.barcode });
      const noSpare = await getBookCopyLookupAction(c1.barcode, s.studentId);
      expect(noSpare!.canReserve).toBe(true);
      expect(noSpare!.otherCopyAvailable).toBe(false);
    });
  });

  // ---------------------------------------------------------------- auth & sessions
  describe("login, passwords and sessions", () => {
    it("a default password (the Library ID) forces a password change — by Library ID or by email — and issues no session", async () => {
      const s = await makeStudent({ defaultPassword: true });
      expect(await redirectTarget(login({}, form({ identifier: s.libraryId, password: s.libraryId })))).toBe(
        `/change-password?first=1&id=${encodeURIComponent(s.libraryId)}`
      );
      expect(await redirectTarget(login({}, form({ identifier: s.email, password: s.libraryId })))).toMatch(
        /^\/change-password\?first=1/
      );
      expect(await getSession()).toBeNull();
    });

    it("wrong password and unknown account get the same answer; an inactive account is only revealed with the right password", async () => {
      const s = await makeStudent({ password: "Correct#Pass1" });
      expect(await login({}, form({ identifier: s.libraryId, password: "wrong-password" }))).toEqual({ error: "Invalid credentials." });
      expect(await login({}, form({ identifier: uid("LIB-NOPE"), password: "wrong-password" }))).toEqual({ error: "Invalid credentials." });

      await User.updateOne({ _id: s.user._id }, { $set: { status: "INACTIVE" } });
      expect(await login({}, form({ identifier: s.libraryId, password: "wrong-password" }))).toEqual({ error: "Invalid credentials." });
      const inactive = await login({}, form({ identifier: s.libraryId, password: "Correct#Pass1" }));
      expect(inactive.error).toMatch(/not active/i);
    });

    it("changing the password signs out older sessions, and the Library ID can't be reused as the new password", async () => {
      const s = await makeStudent({ defaultPassword: true });

      const reuse = await changePassword(
        {},
        form({
          identifier: s.libraryId,
          currentPassword: s.libraryId,
          newPassword: s.libraryId.toLowerCase(),
          confirmPassword: s.libraryId.toLowerCase(),
        })
      );
      expect(reuse.error).toMatch(/isn't your Library ID/i);

      await asStudent(s); // a session from before the change
      expect(
        await redirectTarget(
          changePassword(
            {},
            form({ identifier: s.libraryId, currentPassword: s.libraryId, newPassword: "Brand-New#Pass9", confirmPassword: "Brand-New#Pass9" })
          )
        )
      ).toBe("/login?passwordChanged=1");
      expect((await User.findById(s.user._id))!.sessionVersion).toBe(1);

      expect(await redirectTarget(listOwnReservations(s.studentId))).toBe("/api/auth/signout?reason=expired");

      expect(await redirectTarget(login({}, form({ identifier: s.libraryId, password: "Brand-New#Pass9" })))).toBe("/student/dashboard");
      await expect(listOwnReservations(s.studentId)).resolves.toEqual([]);
    });

    it("deactivating a staff account ends its existing session immediately", async () => {
      const librarian = await staff();
      await expect(getDashboardStats()).resolves.toBeTruthy();
      await User.updateOne({ _id: librarian._id }, { $set: { status: "INACTIVE" } });
      expect(await redirectTarget(getDashboardStats())).toBe("/api/auth/signout?reason=inactive");
    });

    it("a student can only read their own record, clearance and visit log", async () => {
      const a = await makeStudent();
      const b = await makeStudent();
      await LibraryVisit.create({
        visitId: uid("VISIT"),
        studentId: b.student._id,
        entryDate: new Date(),
        entryTime: "10:00",
        entryMethod: "barcode-scan",
        status: "EXITED",
      });

      await asStudent(a);
      await expect(getStudentDetail(b.studentId)).rejects.toThrow(/own records/i);
      await expect(getClearanceStatus(b.studentId)).rejects.toThrow(/own records/i);
      expect((await getStudentDetail(a.studentId))!.student.studentId).toBe(a.studentId);
      expect(await listVisitsForStudent(b.student._id.toString())).toEqual([]);
    });
  });

  // ---------------------------------------------------------------- fines & payments
  describe("fines and payments", () => {
    it("a double-submitted counter payment never records more money than was owed", async () => {
      await staff();
      const s = await makeStudent();
      const fine = await Fine.create({
        fineId: uid("FINE"),
        studentId: s.student._id,
        transactionId: new mongoose.Types.ObjectId(),
        amount: 100,
        reason: "Overdue return",
        status: "PENDING",
      });

      const pay = () => redirectTarget(payFineAction(form({ fineId: fine.fineId, amount: "60", paymentMethod: "cash" })));
      await Promise.all([pay(), pay()]);

      const after = await Fine.findById(fine._id);
      expect(after!.amountPaid).toBeLessThanOrEqual(100);
      if (after!.status === "PARTIALLY_PAID") expect(after!.amountPaid + after!.amount).toBe(100);
      else expect(after!.amountPaid).toBe(100);
    });

    it("a fine that's already paid can't be waived (the payment record is kept)", async () => {
      await staff();
      const s = await makeStudent();
      const fine = await Fine.create({
        fineId: uid("FINE"),
        studentId: s.student._id,
        transactionId: new mongoose.Types.ObjectId(),
        amount: 50,
        amountPaid: 50,
        reason: "Overdue return",
        status: "PAID",
      });
      await redirectTarget(waiveFineAction(form({ fineId: fine.fineId, notes: "trying to waive" })));
      expect((await Fine.findById(fine._id))!.status).toBe("PAID");
    });

    it("the Razorpay webhook marks a fine paid exactly once, even when replayed, and rejects bad signatures", async () => {
      const s = await makeStudent();
      const fine = await Fine.create({
        fineId: uid("FINE"),
        studentId: s.student._id,
        transactionId: new mongoose.Types.ObjectId(),
        amount: 30,
        reason: "Overdue return",
        status: "PENDING",
      });
      const body = JSON.stringify({
        event: "payment_link.paid",
        payload: {
          payment_link: { entity: { id: "plink_test", reference_id: `${fine.fineId}_k2x9` } },
          payment: { entity: { id: "pay_test", amount: 3000 } },
        },
      });
      const signature = createHmac("sha256", "whsec_integration_test").update(body).digest("hex");
      const call = (sig: string) =>
        razorpayWebhook(
          new NextRequest("http://localhost/api/webhooks/razorpay", { method: "POST", body, headers: { "x-razorpay-signature": sig } })
        );

      expect((await call("0".repeat(64))).status).toBe(401);
      expect((await call(signature)).status).toBe(200);
      expect((await call(signature)).status).toBe(200); // replay

      const after = await Fine.findById(fine._id);
      expect(after!.status).toBe("PAID");
      expect(after!.amountPaid).toBe(30);
      expect(after!.paymentReference).toBe("pay_test");
    });
  });

  // ---------------------------------------------------------------- cron, gate, settings, reports
  describe("cron, entry/exit, settings and reports", () => {
    it("the cron endpoint refuses calls without the secret and works with it", async () => {
      const url = "http://localhost/api/cron/due-soon";
      expect((await dueSoonCron(new NextRequest(url))).status).toBe(401);
      expect((await dueSoonCron(new NextRequest(url, { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
      const ok = await dueSoonCron(new NextRequest(url, { headers: { authorization: "Bearer cron_integration_test" } }));
      expect(ok.status).toBe(200);
      expect((await ok.json()).ok).toBe(true);
    });

    it("due-soon reminders are sent once per loan, not on every sweep", async () => {
      await staff();
      const s = await makeStudent();
      const copy = await makeCopy(uid("book"));
      const { transactionId } = await issueBook({ studentId: s.studentId, barcode: copy.barcode });
      await BorrowTransaction.updateOne({ transactionId }, { $set: { dueDate: new Date(Date.now() + DAY) } });

      await runDueSoonSweepCore();
      await runDueSoonSweepCore();
      expect(await Notification.countDocuments({ refId: transactionId })).toBe(1);
    });

    it("a double gate scan never leaves two open visits", async () => {
      await staff("LIBRARY_STAFF");
      const s = await makeStudent();
      await Promise.allSettled([
        redirectTarget(scanEntryExitAction(form({ studentId: s.studentId }))),
        redirectTarget(scanEntryExitAction(form({ studentId: s.studentId }))),
      ]);
      expect(await LibraryVisit.countDocuments({ studentId: s.student._id, status: "INSIDE" })).toBeLessThanOrEqual(1);
    });

    it("a visit left open from an earlier day is auto-closed, and today's scan counts as an entry", async () => {
      await staff("LIBRARY_STAFF");
      const s = await makeStudent();
      const old = await LibraryVisit.create({
        visitId: uid("VISIT"),
        studentId: s.student._id,
        entryDate: new Date(Date.now() - 2 * DAY),
        entryTime: "10:00",
        entryMethod: "barcode-scan",
        status: "INSIDE",
      });

      expect(await redirectTarget(scanEntryExitAction(form({ studentId: s.studentId })))).toBe("/admin/entry-exit");
      expect((await LibraryVisit.findById(old._id))!.status).toBe("EXITED");
      const open = await LibraryVisit.findOne({ studentId: s.student._id, status: "INSIDE" });
      expect(open).not.toBeNull();
      expect(open!.entryTime).toMatch(/^\d{2}:\d{2}$/);
    });

    it("settings keep a real 0 and reject negative values", async () => {
      await staff("SUPER_ADMIN");
      const base = {
        libraryName: "Integration Test Library",
        libraryEmail: "",
        libraryPhone: "",
        libraryAddress: "",
        borrowingDurationDays: "7",
        maxBooksPerStudent: "3",
        finePerDay: "0",
        gracePeriodDays: "0",
        maxRenewals: "0",
        maxFineAmount: "500",
        allowRenewal: "on",
      };
      try {
        expect(await redirectTarget(updateSettingsAction(form(base)))).toBe("/admin/settings");
        let saved: any = await LibrarySettings.findOne().lean();
        expect(saved.finePerDay).toBe(0);
        expect(saved.maxRenewals).toBe(0);

        expect(await redirectTarget(updateSettingsAction(form({ ...base, finePerDay: "-5" })))).toMatch(/^\/admin\/settings\?error=/);
        saved = await LibrarySettings.findOne().lean();
        expect(saved.finePerDay).toBe(0);
      } finally {
        await LibrarySettings.updateMany({}, { $set: BASE_SETTINGS });
      }
    });

    it("report and dashboard aggregations run correctly on MongoDB", async () => {
      await staff();
      const s = await makeStudent();
      const copy = await makeCopy(uid("book"));
      await issueBook({ studentId: s.studentId, barcode: copy.barcode });

      const clearance = await getClearanceReport();
      const row = clearance.find((r: any) => r.studentId === s.studentId);
      expect(row?.eligible).toBe(false);
      expect((await getStudentReport(5)).length).toBeLessThanOrEqual(5);
      expect(Array.isArray(await getDepartmentWiseBorrowing())).toBe(true);
      const active = await getMostActiveStudents(5);
      expect(active.length).toBeGreaterThan(0);
      expect(active.length).toBeLessThanOrEqual(5);
      expect(Array.isArray(await getFineCollectionSummary())).toBe(true);
      expect((await getDashboardStats()).totalStudents).toBeGreaterThan(0);
      const trend = await getIssuesTrend(7);
      expect(trend).toHaveLength(7);
      expect(trend[6].issues).toBeGreaterThan(0); // today (IST) includes the issue above
    });
  });
});
