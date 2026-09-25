"use server";

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import { redirect } from "next/navigation";
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

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;

export async function issueBook(input: IssueBookInput) {
  const session = await requireRole([...STAFF_ROLES]);
  const { studentId, barcode } = issueBookSchema.parse(input);

  await connectToDatabase();
  const settings = (await LibrarySettings.findOne()) ?? (await LibrarySettings.create({}));

  const student = await Student.findOne({ studentId });
  if (!student) throw new Error("No student found for that ID.");
  if (student.status !== "ACTIVE") throw new Error("Student account is suspended.");

  const activeCount = await BorrowTransaction.countDocuments({ studentId: student._id, status: "ACTIVE" });
  if (activeCount >= settings.maxBooksPerStudent) {
    throw new Error("Student has reached the maximum borrowing limit.");
  }

  const pendingFine = await Fine.exists({ studentId: student._id, status: "PENDING" });
  if (pendingFine) throw new Error("Student has an outstanding restriction.");

  const copy = await BookCopy.findOne({ barcode });
  if (!copy) throw new Error("Invalid or unrecognized barcode.");

  let matchingReservation: any = null;
  if (copy.status === "RESERVED") {
    matchingReservation = await Reservation.findOne({ bookCopyId: copy._id, status: "READY" });
    if (!matchingReservation || matchingReservation.studentId.toString() !== student._id.toString()) {
      throw new Error("This copy is held for another student's reservation.");
    }
  } else if (copy.status !== "AVAILABLE") {
    throw new Error("Book copy is already issued.");
  }

  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + settings.borrowingDurationDays);

  const mongoSession = await mongoose.startSession();
  try {
    let transactionId = "";
    await mongoSession.withTransaction(async () => {
      copy.status = "ISSUED";
      await copy.save({ session: mongoSession });

      if (matchingReservation) {
        matchingReservation.status = "FULFILLED";
        matchingReservation.fulfilledAt = new Date();
        await matchingReservation.save({ session: mongoSession });
      }

      transactionId = `TXN-${Date.now()}`;
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
            newValue: { studentId: student.studentId, barcode, dueDate },
          },
        ],
        { session: mongoSession }
      );
    });

    return { transactionId, dueDate };
  } finally {
    await mongoSession.endSession();
  }
}

export async function returnBook(input: ReturnBookInput) {
  const session = await requireRole([...STAFF_ROLES]);
  const { barcode } = returnBookSchema.parse(input);

  await connectToDatabase();
  const settings = (await LibrarySettings.findOne()) ?? (await LibrarySettings.create({}));

  const copy = await BookCopy.findOne({ barcode });
  if (!copy) throw new Error("Invalid or unrecognized barcode.");

  const txn = await BorrowTransaction.findOne({ bookCopyId: copy._id, status: "ACTIVE" });
  if (!txn) throw new Error("No active issue transaction found.");

  const returningStudent = await Student.findById(txn.studentId).select("name studentId").lean<{ name: string; studentId: string }>();

  const returnDate = new Date();
  const overdueDays = calculateOverdueDays(txn.dueDate, returnDate);

  const mongoSession = await mongoose.startSession();
  try {
    let fineAmount = 0;
    let heldForReservation: any = null;

    await mongoSession.withTransaction(async () => {
      txn.returnDate = returnDate;
      txn.returnedTo = new mongoose.Types.ObjectId(session.userId);
      txn.status = "RETURNED";
      await txn.save({ session: mongoSession });

      // If someone is waiting on this title, hold the copy for them instead of freeing it.
      const pendingReservation = await Reservation.findOne({
        sanityBookId: copy.sanityBookId,
        status: "PENDING",
      })
        .sort({ requestedAt: 1 })
        .session(mongoSession);

      if (pendingReservation) {
        copy.status = "RESERVED";
        pendingReservation.status = "READY";
        pendingReservation.bookCopyId = copy._id;
        pendingReservation.readyAt = returnDate;
        await pendingReservation.save({ session: mongoSession });
        heldForReservation = {
          reservationId: pendingReservation.reservationId,
          studentId: pendingReservation.studentId.toString(),
        };
      } else {
        copy.status = "AVAILABLE";
      }
      await copy.save({ session: mongoSession });

      if (overdueDays > 0) {
        fineAmount = calculateFineAmount(overdueDays, settings.finePerDay, settings.maxFineAmount);
        await Fine.create(
          [
            {
              fineId: `FINE-${Date.now()}`,
              studentId: txn.studentId,
              transactionId: txn._id,
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
            entityId: txn.transactionId,
            newValue: { overdueDays, fineAmount },
          },
        ],
        { session: mongoSession }
      );
    });

    if (overdueDays > 0) {
      await notify(txn.studentId.toString(), "FINE_ISSUED", `A fine of ₹${fineAmount} was recorded for an overdue return.`);
    }
    if (heldForReservation) {
      await notify(heldForReservation.studentId, "RESERVATION_READY", "Your reserved book is ready for pickup at the counter.");
    }

    return { overdueDays, fineAmount, studentName: returningStudent?.name };
  } finally {
    await mongoSession.endSession();
  }
}

export async function renewBook(input: { transactionId: string }) {
  const session = await requireRole([...STAFF_ROLES]);
  const { transactionId } = renewBookSchema.parse(input);

  await connectToDatabase();
  const settings = (await LibrarySettings.findOne()) ?? (await LibrarySettings.create({}));

  const txn = await BorrowTransaction.findOne({ transactionId });
  if (!txn) throw new Error("Transaction not found.");
  if (txn.status !== "ACTIVE") throw new Error("Book already returned.");
  if (!settings.allowRenewal) throw new Error("Renewals are disabled for this library.");
  if (txn.renewalCount >= settings.maxRenewals) throw new Error("Renewal limit reached.");

  const student = await Student.findById(txn.studentId);
  if (!student || student.status === "BLOCKED" || student.status === "SUSPENDED") {
    throw new Error("Student is blocked or suspended.");
  }

  txn.dueDate = new Date(txn.dueDate.getTime() + settings.borrowingDurationDays * 86400000);
  txn.renewalCount += 1;
  await txn.save();

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "BOOK_RENEWED",
    entityType: "BorrowTransaction",
    entityId: txn.transactionId,
    newValue: { newDueDate: txn.dueDate, renewalCount: txn.renewalCount },
  });

  return { dueDate: txn.dueDate, renewalCount: txn.renewalCount };
}

/** Form-bound wrappers — parse FormData, call the typed action above, redirect with a friendly error on failure. */

export async function issueBookFormAction(formData: FormData) {
  try {
    await issueBook({
      studentId: String(formData.get("studentId")),
      barcode: String(formData.get("barcode")),
    });
  } catch (err) {
    redirect(`/admin/issue?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/admin/issue");
  redirect("/admin/issue?success=1");
}

export async function returnBookFormAction(formData: FormData) {
  let result: { overdueDays: number; fineAmount: number; studentName?: string } | undefined;
  try {
    result = await returnBook({ barcode: String(formData.get("barcode")) });
  } catch (err) {
    redirect(`/admin/return?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/admin/return");
  const name = encodeURIComponent(result?.studentName ?? "");
  redirect(`/admin/return?success=1&overdueDays=${result?.overdueDays}&fineAmount=${result?.fineAmount}&studentName=${name}`);
}

export async function renewBookFormAction(formData: FormData) {
  try {
    await renewBook({ transactionId: String(formData.get("transactionId")) });
  } catch (err) {
    redirect(`/admin/renewals?error=${encodeURIComponent((err as Error).message)}`);
  }
  revalidatePath("/admin/renewals");
  redirect("/admin/renewals?success=1");
}
