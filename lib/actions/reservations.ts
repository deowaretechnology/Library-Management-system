"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { notify } from "@/lib/notifications/send";
import Reservation from "@/models/Reservation";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";

export async function reserveBookAction(formData: FormData) {
  const session = await requireRole(["STUDENT", "SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  const studentIdInput = String(formData.get("studentId"));
  const sanityBookId = String(formData.get("sanityBookId"));

  if (session.role === "STUDENT") assertOwnStudentRecord(session, studentIdInput);

  await connectToDatabase();
  const student = await Student.findOne({ studentId: studentIdInput });
  if (!student) redirect(`/student/books?error=${encodeURIComponent("Student not found.")}`);

  const availableCopies = await BookCopy.countDocuments({ sanityBookId, status: "AVAILABLE" });
  if (availableCopies > 0) {
    redirect(`/student/books?error=${encodeURIComponent("Copies are available right now — use Quick Issue instead of reserving.")}`);
  }

  const existing = await Reservation.findOne({
    studentId: student!._id,
    sanityBookId,
    status: { $in: ["AWAITING_APPROVAL", "PENDING", "READY"] },
  });
  if (existing) redirect(`/student/books?error=${encodeURIComponent("You already have a reservation for this title.")}`);

  // Student-initiated reservations start as AWAITING_APPROVAL — they don't hold a spot
  // in the queue (a due-back copy can't be offered to them) until a librarian approves
  // the request. Staff-created reservations (reserveForStudentAction, below) skip this —
  // a staff member creating it IS the approval.
  await Reservation.create({
    reservationId: `RES-${Date.now()}`,
    studentId: student!._id,
    sanityBookId,
    status: "AWAITING_APPROVAL",
  });

  revalidatePath("/admin/reservations");
  revalidatePath("/student/reservations");
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
    await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
    await connectToDatabase();

    const student = await Student.findOne({ studentId });
    if (!student) return { error: "Student not found." };

    const availableCopies = await BookCopy.countDocuments({ sanityBookId, status: "AVAILABLE" });
    if (availableCopies > 0) {
      return { error: "A copy is available right now — issue it directly instead of reserving." };
    }

    const existing = await Reservation.findOne({
      studentId: student._id,
      sanityBookId,
      status: { $in: ["AWAITING_APPROVAL", "PENDING", "READY"] },
    });
    if (existing) {
      return {
        error:
          existing.status === "AWAITING_APPROVAL"
            ? "This student already requested this title — approve it from the Reservations page instead."
            : "This student already has a reservation for this title.",
      };
    }

    await Reservation.create({
      reservationId: `RES-${Date.now()}`,
      studentId: student._id,
      sanityBookId,
      status: "PENDING",
    });

    revalidatePath("/admin/reservations");
    revalidatePath("/student/reservations");
    return { success: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/**
 * Turns a student-requested AWAITING_APPROVAL reservation into a real, queued PENDING
 * one — from here on it behaves exactly like a staff-created reservation (eligible to
 * be offered the next returned copy).
 */
export async function approveReservationAction(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  const reservationId = String(formData.get("reservationId"));

  await connectToDatabase();
  const reservation = await Reservation.findOne({ reservationId });
  if (!reservation || reservation.status !== "AWAITING_APPROVAL") {
    revalidatePath("/admin/reservations");
    return;
  }

  reservation.status = "PENDING";
  reservation.approvedAt = new Date();
  reservation.approvedBy = session.userId as any;
  await reservation.save();

  await notify(reservation.studentId.toString(), "RESERVATION_APPROVED", "Your book reservation was approved and is now in the queue.");

  revalidatePath("/admin/reservations");
  revalidatePath("/student/reservations");
}

/** Declines a student's AWAITING_APPROVAL request — same effect as cancelling, but tells the student it was rejected rather than that they cancelled it themselves. */
export async function rejectReservationAction(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  void session;
  const reservationId = String(formData.get("reservationId"));

  await connectToDatabase();
  const reservation = await Reservation.findOne({ reservationId });
  if (!reservation || reservation.status !== "AWAITING_APPROVAL") {
    revalidatePath("/admin/reservations");
    return;
  }

  reservation.status = "CANCELLED";
  reservation.cancelledAt = new Date();
  await reservation.save();

  await notify(reservation.studentId.toString(), "RESERVATION_REJECTED", "Your book reservation request wasn't approved. Contact the library desk for details.");

  revalidatePath("/admin/reservations");
  revalidatePath("/student/reservations");
}

/** Powers the sidebar badge that surfaces new student reservation requests to staff. */
export async function countReservationsAwaitingApproval(): Promise<number> {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();
  return Reservation.countDocuments({ status: "AWAITING_APPROVAL" });
}

export async function cancelReservationAction(formData: FormData) {
  const session = await requireRole(["STUDENT", "SUPER_ADMIN", "LIBRARIAN"]);
  const reservationId = String(formData.get("reservationId"));

  await connectToDatabase();
  const reservation = await Reservation.findOne({ reservationId });
  if (!reservation) return;

  if (session.role === "STUDENT") {
    const student = await Student.findById(reservation.studentId);
    if (!student || student.studentId !== session.studentId) {
      throw new Error("You can only cancel your own reservations.");
    }
  }

  reservation.status = "CANCELLED";
  reservation.cancelledAt = new Date();
  await reservation.save();

  // If a copy was already being held for this reservation, free it back up.
  if (reservation.bookCopyId) {
    await BookCopy.updateOne({ _id: reservation.bookCopyId, status: "RESERVED" }, { $set: { status: "AVAILABLE" } });
  }

  revalidatePath("/admin/reservations");
  revalidatePath("/student/reservations");
}

export async function listReservations(status?: string) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  return Reservation.find(filter)
    .sort({ requestedAt: -1 })
    .populate("studentId", "name studentId")
    .lean();
}

export async function listOwnReservations(studentId: string) {
  const session = await requireRole(["STUDENT"]);
  assertOwnStudentRecord(session, studentId);

  await connectToDatabase();
  const student = await Student.findOne({ studentId });
  if (!student) return [];
  return Reservation.find({ studentId: student._id }).sort({ requestedAt: -1 }).lean();
}
