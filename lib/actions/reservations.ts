"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
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
    status: { $in: ["PENDING", "READY"] },
  });
  if (existing) redirect(`/student/books?error=${encodeURIComponent("You already have a reservation for this title.")}`);

  await Reservation.create({
    reservationId: `RES-${Date.now()}`,
    studentId: student!._id,
    sanityBookId,
    status: "PENDING",
  });

  revalidatePath("/student/reservations");
  redirect("/student/reservations?success=1");
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
