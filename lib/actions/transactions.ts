"use server";

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  issueBookSchema,
  returnBookSchema,
  renewBookSchema,
  IssueBookInput,
  ReturnBookInput,
} from "@/validators/transactions";
import BookCopy from "@/models/BookCopy";
import Student from "@/models/Student";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import LibrarySettings from "@/models/LibrarySettings";
import AuditLog from "@/models/AuditLog";
import Reservation from "@/models/Reservation";
import { notify } from "@/lib/notifications/send";
import { calculateOverdueDays, calculateFineAmount } from "@/lib/domain/fines";
import { endOfIstDayAfter } from "@/lib/domain/dates";
import { makeId } from "@/lib/domain/ids";
import { offerCopyToQueue } from "@/lib/domain/reservationQueue";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;
const OUTSTANDING_FINE = { $in: ["PENDING", "PARTIALLY_PAID"] };
const OPEN_RESERVATION = { $in: ["AWAITING_APPROVAL", "PENDING", "READY"] };

async function loadSettings() {
  return (await LibrarySettings.findOne().lean<any>()) ?? (await LibrarySettings.create({})).toObject();
}

/** Thrown inside a transaction for a business-rule failure — never retried. */
class IssueError extends Error {}

export async function issueBook(input: IssueBookInput) {
  const session = await requireRole([...STAFF_ROLES]);
  const { studentId, barcode } = issueBookSchema.parse(input);

  await connectToDatabase();
  const [settings, student, copy] = await Promise.all([
    loadSettings(),
    Student.findOne({ studentId: studentId.trim() }).lean<any>(),
    BookCopy.findOne({ barcode: barcode.trim() }).lean<any>(),
  ]);

  if (!student) throw new Error("No student found for that ID.");
  if (student.status !== "ACTIVE") throw new Error(`Student account is ${student.status.toLowerCase()}.`);
  if (!copy) throw new Error("Invalid or unrecognized barcode.");

  // Fast, friendly pre-checks. The limit and the copy status are re-checked INSIDE the
  // transaction below — these alone are not safe against two counters acting at once.
  const [activeCount, outstandingFine] = await Promise.all([
    BorrowTransaction.countDocuments({ studentId: student._id, status: "ACTIVE" }),
    // PARTIALLY_PAID counts too — paying ₹1 of a ₹100 fine used to unblock borrowing,
    // while the Quick Issue card (correctly) still showed the student as ineligible.
    Fine.exists({ studentId: student._id, status: OUTSTANDING_FINE }),
  ]);
  if (activeCount >= settings.maxBooksPerStudent) throw new Error("Student has reached the maximum borrowing limit.");
  if (outstandingFine) throw new Error("Student has an outstanding fine.");

  if (copy.status === "RESERVED") {
    const hold = await Reservation.findOne({ bookCopyId: copy._id, status: "READY" }).lean<any>();
    if (!hold || hold.studentId.toString() !== student._id.toString()) {
      throw new Error("This copy is held for another student's reservation.");
    }
  } else if (copy.status !== "AVAILABLE") {
    throw new Error(copy.status === "ISSUED" ? "Book copy is already issued." : `Book copy is ${copy.status.toLowerCase()}.`);
  }

  const issueDate = new Date();
  // Due at the END of the IST day, N days from today — see lib/domain/dates.ts.
  const dueDate = endOfIstDayAfter(issueDate, settings.borrowingDurationDays);
  const transactionId = makeId("TXN");
  const notifyReady: string[] = []; // students whose hold became READY because of this issue

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      notifyReady.length = 0; // withTransaction may retry this callback — start clean

      // 1. Touch the student's row first: two concurrent issues for the SAME student now
      //    write-conflict here, so one retries and sees the other's loan in the count below.
      await Student.updateOne({ _id: student._id }, { $set: { lastIssueAt: issueDate } }, { session: mongoSession });
      const count = await BorrowTransaction.countDocuments({ studentId: student._id, status: "ACTIVE" }).session(mongoSession);
      if (count >= settings.maxBooksPerStudent) throw new IssueError("Student has reached the maximum borrowing limit.");

      // 2. Claim the copy atomically: only succeeds if it is STILL in the status we checked.
      //    Previously a plain copy.save() let two librarians issue the same copy at once.
      const claimed = await BookCopy.findOneAndUpdate(
        { _id: copy._id, status: copy.status },
        { $set: { status: "ISSUED" } },
        { session: mongoSession, new: true }
      );
      if (!claimed) throw new IssueError("This copy was just issued or reserved by someone else — scan again.");

      // 3. Close ALL of this student's open reservations for this title (the READY hold on
      //    this copy, and also any PENDING / AWAITING_APPROVAL request — otherwise a later
      //    return would be held for a student who already has the book).
      const openForTitle = await Reservation.find({
        studentId: student._id,
        sanityBookId: copy.sanityBookId,
        status: OPEN_RESERVATION,
      }).session(mongoSession);
      if (openForTitle.length) {
        await Reservation.updateMany(
          { _id: { $in: openForTitle.map((r) => r._id) } },
          { $set: { status: "FULFILLED", fulfilledAt: issueDate } },
          { session: mongoSession }
        );
      }
      // A READY hold on a DIFFERENT copy of this title is released to the next student in
      // line — inside the same transaction, so the copy can never be left RESERVED with no hold.
      for (const r of openForTitle) {
        if (r.status === "READY" && r.bookCopyId && r.bookCopyId.toString() !== copy._id.toString()) {
          const next = await offerCopyToQueue(r.bookCopyId, r.sanityBookId, mongoSession);
          if (next) notifyReady.push(next.studentId);
        }
      }

      await BorrowTransaction.create(
        [
          {
            transactionId,
            studentId: student._id,
            sanityBookId: copy.sanityBookId,
            bookCopyId: copy._id,
            issueDate,
            dueDate,
            issuedBy: session.userId,
            status: "ACTIVE",
          },
        ],
        { session: mongoSession }
      );

      await AuditLog.create(
        [
          {
            userId: session.userId,
            role: session.role,
            action: "BOOK_ISSUED",
            entityType: "BorrowTransaction",
            entityId: transactionId,
            newValue: { studentId: student.studentId, barcode: copy.barcode, dueDate },
          },
        ],
        { session: mongoSession }
      );
    });
  } catch (err: any) {
    // Unique-index backstop (one ACTIVE loan per copy) fired — same meaning as a lost race.
    if (err?.code === 11000) throw new Error("This copy was just issued by someone else — scan again.");
    throw err;
  } finally {
    await mongoSession.endSession();
  }

  for (const studentToNotify of notifyReady) {
    await notify(studentToNotify, "RESERVATION_READY", "Your reserved book is ready for pickup at the counter.").catch(() => {});
  }

  return { transactionId, dueDate };
}

export async function returnBook(input: ReturnBookInput) {
  const session = await requireRole([...STAFF_ROLES]);
  const { barcode } = returnBookSchema.parse(input);

  await connectToDatabase();
  const [settings, copy] = await Promise.all([loadSettings(), BookCopy.findOne({ barcode: barcode.trim() }).lean<any>()]);
  if (!copy) throw new Error("Invalid or unrecognized barcode.");

  const txnPre = await BorrowTransaction.findOne({ bookCopyId: copy._id, status: "ACTIVE" }).lean<any>();
  if (!txnPre) throw new Error("No active issue transaction found.");

  const returningStudent = await Student.findById(txnPre.studentId).select("name studentId").lean<{ name: string; studentId: string }>();

  const returnDate = new Date();
  const overdueDays = calculateOverdueDays(txnPre.dueDate, returnDate);
  // gracePeriodDays was saved in Settings but never applied — the first N late days are now free.
  const chargeableDays = Math.max(0, overdueDays - (settings.gracePeriodDays ?? 0));
  const fineAmount = calculateFineAmount(chargeableDays, settings.finePerDay, settings.maxFineAmount);

  let heldFor: { studentId: string } | null = null;

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      heldFor = null;
      // Atomic close: a double scan / double click can no longer return the book twice
      // (which used to create two fines and put two reservations on one copy).
      const closed = await BorrowTransaction.findOneAndUpdate(
        { _id: txnPre._id, status: "ACTIVE" },
        { $set: { status: "RETURNED", returnDate, returnedTo: new mongoose.Types.ObjectId(session.userId) } },
        { session: mongoSession, new: true }
      );
      if (!closed) throw new IssueError("This book was already returned.");

      // Next student in the queue gets the copy (atomically), otherwise it goes back on the shelf.
      heldFor = await offerCopyToQueue(copy._id, copy.sanityBookId, mongoSession);

      if (fineAmount > 0) {
        await Fine.create(
          [
            {
              fineId: makeId("FINE"),
              studentId: txnPre.studentId,
              transactionId: txnPre._id,
              amount: fineAmount,
              reason: "Overdue return",
              overdueDays,
              status: "PENDING",
            },
          ],
          { session: mongoSession }
        );
      }

      await AuditLog.create(
        [
          {
            userId: session.userId,
            role: session.role,
            action: "BOOK_RETURNED",
            entityType: "BorrowTransaction",
            entityId: txnPre.transactionId,
            newValue: { overdueDays, chargeableDays, fineAmount },
          },
        ],
        { session: mongoSession }
      );
    });
  } finally {
    await mongoSession.endSession();
  }

  if (fineAmount > 0) {
    await notify(txnPre.studentId.toString(), "FINE_ISSUED", `A fine of ₹${fineAmount} was recorded for an overdue return.`).catch(() => {});
  }
  const next = heldFor as { studentId: string } | null;
  if (next) {
    await notify(next.studentId, "RESERVATION_READY", "Your reserved book is ready for pickup at the counter.").catch(() => {});
  }

  return { overdueDays, fineAmount, studentName: returningStudent?.name };
}

export async function renewBook(input: { transactionId: string }) {
  const session = await requireRole([...STAFF_ROLES]);
  const { transactionId } = renewBookSchema.parse(input);

  await connectToDatabase();
  const [settings, txn] = await Promise.all([
    loadSettings(),
    BorrowTransaction.findOne({ transactionId: transactionId.trim() }).lean<any>(),
  ]);
  if (!txn) throw new Error("Transaction not found.");
  if (txn.status !== "ACTIVE") throw new Error("Book already returned.");
  if (!settings.allowRenewal) throw new Error("Renewals are disabled for this library.");
  if (txn.renewalCount >= settings.maxRenewals) throw new Error("Renewal limit reached.");
  // Renewing an overdue book used to push the due date forward and silently erase the fine.
  if (new Date(txn.dueDate) < new Date()) {
    throw new Error("This book is overdue — return it (the fine applies) instead of renewing.");
  }

  const [student, outstandingFine, othersWaiting] = await Promise.all([
    Student.findById(txn.studentId).select("status").lean<any>(),
    Fine.exists({ studentId: txn.studentId, status: OUTSTANDING_FINE }),
    Reservation.exists({
      sanityBookId: txn.sanityBookId,
      status: { $in: ["PENDING", "READY"] },
      studentId: { $ne: txn.studentId },
    }),
  ]);
  if (!student || student.status !== "ACTIVE") throw new Error("Student account is not active.");
  if (outstandingFine) throw new Error("Student has an outstanding fine — clear it before renewing.");
  if (othersWaiting) throw new Error("Another student is waiting for this title — it can't be renewed.");

  const newDueDate = endOfIstDayAfter(new Date(txn.dueDate), settings.borrowingDurationDays);

  // Conditional on the renewalCount we just read: two simultaneous renewals can no longer
  // both succeed and exceed maxRenewals.
  const updated = await BorrowTransaction.findOneAndUpdate(
    { _id: txn._id, status: "ACTIVE", renewalCount: txn.renewalCount },
    { $set: { dueDate: newDueDate }, $inc: { renewalCount: 1 } },
    { new: true }
  );
  if (!updated) throw new Error("This loan was just changed by someone else — refresh and try again.");

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "BOOK_RENEWED",
    entityType: "BorrowTransaction",
    entityId: updated.transactionId,
    previousValue: { dueDate: txn.dueDate, renewalCount: txn.renewalCount },
    newValue: { newDueDate: updated.dueDate, renewalCount: updated.renewalCount },
  });

  return { dueDate: updated.dueDate, renewalCount: updated.renewalCount };
}

/** Form-bound wrappers — parse FormData, call the typed action above, redirect with a friendly error on failure. */

/**
 * Non-redirecting version for the Quick Issue counter flow: a student can borrow up to
 * maxBooksPerStudent books in one visit, so each scan should stay on the same student's
 * profile (camera ready for the next book) instead of bouncing back to Step 1 via a full
 * page redirect. The caller re-fetches the profile afterwards to show the updated count.
 */
export async function issueBookAction(
  studentId: string,
  barcode: string
): Promise<{ success: true; dueDate: Date } | { error: string }> {
  try {
    const { dueDate } = await issueBook({ studentId: String(studentId), barcode: String(barcode) });
    revalidatePath("/admin/issue");
    return { success: true, dueDate };
  } catch (err) {
    unstable_rethrow(err); // let a session-expired redirect through
    return { error: (err as Error).message };
  }
}

export async function returnBookFormAction(formData: FormData) {
  let result: { overdueDays: number; fineAmount: number; studentName?: string } | undefined;
  try {
    result = await returnBook({ barcode: String(formData.get("barcode") ?? "") });
  } catch (err) {
    unstable_rethrow(err);
    redirect(`/admin/return?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/admin/return");
  const name = encodeURIComponent(result?.studentName ?? "");
  redirect(`/admin/return?success=1&overdueDays=${result?.overdueDays}&fineAmount=${result?.fineAmount}&studentName=${name}`);
}

export async function renewBookFormAction(formData: FormData) {
  try {
    await renewBook({ transactionId: String(formData.get("transactionId") ?? "") });
  } catch (err) {
    unstable_rethrow(err);
    redirect(`/admin/renewals?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/admin/renewals");
  redirect("/admin/renewals?success=1");
}
