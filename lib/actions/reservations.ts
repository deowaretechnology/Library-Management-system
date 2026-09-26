"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { notify } from "@/lib/notifications/send";
import { makeId } from "@/lib/domain/ids";
import { offerCopyToQueue } from "@/lib/domain/reservationQueue";
import Reservation from "@/models/Reservation";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;
const OPEN_STATUSES = ["AWAITING_APPROVAL", "PENDING", "READY"];
const ALL_STATUSES = ["AWAITING_APPROVAL", "PENDING", "READY", "FULFILLED", "CANCELLED", "EXPIRED"];

function revalidateReservationPages() {
  revalidatePath("/admin/reservations");
  revalidatePath("/student/reservations");
  revalidatePath("/admin", "layout"); // sidebar "awaiting approval" badge
}

export async function reserveBookAction(formData: FormData) {
  const session = await requireRole(["STUDENT", "SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  const studentIdInput = String(formData.get("studentId") ?? "");
  const sanityBookId = String(formData.get("sanityBookId") ?? "");
  if (!studentIdInput || !sanityBookId) redirect(`/student/books?error=${encodeURIComponent("Missing book or student.")}`);

  if (session.role === "STUDENT") assertOwnStudentRecord(session, studentIdInput);

  await connectToDatabase();
  const student = await Student.findOne({ studentId: studentIdInput }).lean<any>();
  if (!student) redirect(`/student/books?error=${encodeURIComponent("Student not found.")}`);
  if (student.status !== "ACTIVE") {
    redirect(`/student/books?error=${encodeURIComponent(`Your library account is ${student.status.toLowerCase()} — contact the library desk.`)}`);
  }

  const availableCopies = await BookCopy.countDocuments({ sanityBookId, status: "AVAILABLE" });
  if (availableCopies > 0) {
    redirect(`/student/books?error=${encodeURIComponent("Copies are available right now — ask at the counter to issue one.")}`);
  }

  const existing = await Reservation.exists({ studentId: student._id, sanityBookId, status: { $in: OPEN_STATUSES } });
  if (existing) redirect(`/student/books?error=${encodeURIComponent("You already have a reservation for this title.")}`);

  // Student-initiated reservations start as AWAITING_APPROVAL — they don't hold a spot in
  // the queue (a returned copy can't be offered to them) until a librarian approves the
  // request. Staff-created reservations (reserveForStudentAction, below) skip this — a
  // staff member creating it IS the approval.
  await Reservation.create({
    reservationId: makeId("RES"),
    studentId: student._id,
    sanityBookId,
    status: "AWAITING_APPROVAL",
  });

  revalidateReservationPages();
  redirect("/student/reservations?success=1");
}

/**
 * Non-redirecting version of reserveBookAction, for the Quick Issue counter flow: when a
 * scanned book turns out to be already issued to someone else, staff can reserve it for
 * the student they're currently serving right there, instead of that student having to
 * come back later and reserve it themselves from their own account.
 */
export async function reserveForStudentAction(
  studentId: string,
  sanityBookId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireRole([...STAFF_ROLES]);
    await connectToDatabase();

    const student = await Student.findOne({ studentId: String(studentId) }).lean<any>();
    if (!student) return { error: "Student not found." };
    if (student.status !== "ACTIVE") return { error: `Student account is ${student.status.toLowerCase()}.` };

    const availableCopies = await BookCopy.countDocuments({ sanityBookId: String(sanityBookId), status: "AVAILABLE" });
    if (availableCopies > 0) return { error: "A copy is available right now — issue it directly instead of reserving." };

    const existing = await Reservation.findOne({
      studentId: student._id,
      sanityBookId: String(sanityBookId),
      status: { $in: OPEN_STATUSES },
    }).lean<any>();
    if (existing) {
      return {
        error:
          existing.status === "AWAITING_APPROVAL"
            ? "This student already requested this title — approve it from the Reservations page instead."
            : "This student already has a reservation for this title.",
      };
    }

    await Reservation.create({
      reservationId: makeId("RES"),
      studentId: student._id,
      sanityBookId: String(sanityBookId),
      status: "PENDING",
    });

    revalidateReservationPages();
    return { success: true };
  } catch (err) {
    unstable_rethrow(err);
    return { error: (err as Error).message };
  }
}

/**
 * Turns a student-requested AWAITING_APPROVAL reservation into a real, queued one. If a
 * copy happens to be on the shelf right now, it's held for them immediately (READY) —
 * previously the approved student just sat in the queue while copies stayed AVAILABLE.
 */
export async function approveReservationAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
  const reservationId = String(formData.get("reservationId") ?? "");

  await connectToDatabase();
  // Atomic status transition — a double click can't approve twice or approve a cancelled one.
  const reservation = await Reservation.findOneAndUpdate(
    { reservationId, status: "AWAITING_APPROVAL" },
    { $set: { status: "PENDING", approvedAt: new Date(), approvedBy: session.userId } },
    { new: true }
  );
  if (!reservation) {
    revalidateReservationPages();
    return;
  }

  const freeCopy = await BookCopy.findOneAndUpdate(
    { sanityBookId: reservation.sanityBookId, status: "AVAILABLE" },
    { $set: { status: "RESERVED" } },
    { new: true }
  );

  if (freeCopy) {
    const held = await Reservation.findOneAndUpdate(
      { _id: reservation._id, status: "PENDING" },
      { $set: { status: "READY", bookCopyId: freeCopy._id, readyAt: new Date() } },
      { new: true }
    );
    if (held) {
      await notify(reservation.studentId.toString(), "RESERVATION_READY", "Your reservation was approved and the book is ready for pickup at the counter.");
    } else {
      // Reservation changed underneath us — give the copy to whoever is next instead.
      await offerCopyToQueue(freeCopy._id, freeCopy.sanityBookId);
    }
  } else {
    await notify(reservation.studentId.toString(), "RESERVATION_APPROVED", "Your book reservation was approved and is now in the queue.");
  }

  revalidateReservationPages();
}

/** Declines a student's AWAITING_APPROVAL request and tells them it was rejected (not that they cancelled it). */
export async function rejectReservationAction(formData: FormData) {
  await requireRole([...STAFF_ROLES]);
  const reservationId = String(formData.get("reservationId") ?? "");

  await connectToDatabase();
  const reservation = await Reservation.findOneAndUpdate(
    { reservationId, status: "AWAITING_APPROVAL" },
    { $set: { status: "CANCELLED", cancelledAt: new Date() } },
    { new: true }
  );
  if (reservation) {
    await notify(
      reservation.studentId.toString(),
      "RESERVATION_REJECTED",
      "Your book reservation request wasn't approved. Contact the library desk for details."
    );
  }

  revalidateReservationPages();
}

/** Powers the sidebar badge that surfaces new student reservation requests to staff. */
export async function countReservationsAwaitingApproval(): Promise<number> {
  await requireRole([...STAFF_ROLES]);
  await connectToDatabase();
  return Reservation.countDocuments({ status: "AWAITING_APPROVAL" });
}

export async function cancelReservationAction(formData: FormData) {
  // LIBRARY_STAFF was missing here — they could create/approve/reject but got an error page on Cancel.
  const session = await requireRole(["STUDENT", ...STAFF_ROLES]);
  const reservationId = String(formData.get("reservationId") ?? "");

  await connectToDatabase();
  const reservation = await Reservation.findOne({ reservationId }).lean<any>();
  if (!reservation) return;

  if (session.role === "STUDENT") {
    const student = await Student.findById(reservation.studentId).select("studentId").lean<any>();
    if (!student || student.studentId !== session.studentId) {
      throw new Error("You can only cancel your own reservations.");
    }
  }

  // Only open reservations can be cancelled — FULFILLED/EXPIRED history can't be rewritten.
  const cancelled = await Reservation.findOneAndUpdate(
    { _id: reservation._id, status: { $in: OPEN_STATUSES } },
    { $set: { status: "CANCELLED", cancelledAt: new Date() } },
    { new: false } // return the pre-update doc so we know whether it was holding a copy
  );

  // A copy held for this reservation goes to the NEXT student in the queue — it used to go
  // straight back to the shelf, letting a walk-in jump ahead of everyone waiting.
  if (cancelled?.status === "READY" && cancelled.bookCopyId) {
    const next = await offerCopyToQueue(cancelled.bookCopyId, cancelled.sanityBookId);
    if (next) await notify(next.studentId, "RESERVATION_READY", "Your reserved book is ready for pickup at the counter.");
  }

  revalidateReservationPages();
}

export async function listReservations(status?: string) {
  await requireRole([...STAFF_ROLES]);
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  // Only accept a known status string — never pass a raw client value into the query.
  if (status && ALL_STATUSES.includes(String(status))) filter.status = String(status);
  return Reservation.find(filter)
    .sort({ requestedAt: -1 })
    .limit(300)
    .populate("studentId", "name studentId")
    .lean();
}

export async function listOwnReservations(studentId: string) {
  const session = await requireRole(["STUDENT"]);
  assertOwnStudentRecord(session, studentId);

  await connectToDatabase();
  const student = await Student.findOne({ studentId }).select("_id").lean<any>();
  if (!student) return [];
  return Reservation.find({ studentId: student._id }).sort({ requestedAt: -1 }).limit(100).lean();
}
