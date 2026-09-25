"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import Student from "@/models/Student";
import LibraryVisit from "@/models/LibraryVisit";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;

function timeString(d: Date) {
  return d.toISOString().slice(11, 16); // "HH:mm"
}

/** Scanning a Student ID toggles entry/exit — no open visit creates one, an open one closes it. */
export async function scanEntryExitAction(formData: FormData) {
  await requireRole([...STAFF_ROLES]);
  const studentId = String(formData.get("studentId"));

  await connectToDatabase();
  const student = await Student.findOne({ studentId });
  if (!student) redirect(`/admin/entry-exit?error=${encodeURIComponent("Invalid or unrecognized Student ID.")}`);

  const openVisit = await LibraryVisit.findOne({ studentId: student!._id, status: "INSIDE" });
  const now = new Date();

  if (openVisit) {
    openVisit.exitDate = now;
    openVisit.exitTime = timeString(now);
    openVisit.exitMethod = "barcode-scan";
    openVisit.status = "EXITED";
    openVisit.durationMinutes = Math.round(
      (now.getTime() - openVisit.entryDate.getTime()) / 60000
    );
    await openVisit.save();
  } else {
    await LibraryVisit.create({
      visitId: `VISIT-${Date.now()}`,
      studentId: student!._id,
      entryDate: now,
      entryTime: timeString(now),
      entryMethod: "barcode-scan",
      status: "INSIDE",
    });
  }

  revalidatePath("/admin/entry-exit");
  redirect("/admin/entry-exit");
}

export async function listCurrentlyInside() {
  await connectToDatabase();
  return LibraryVisit.find({ status: "INSIDE" })
    .sort({ entryDate: -1 })
    .populate("studentId", "name studentId department")
    .lean();
}

export async function listRecentVisits(limit = 20) {
  await connectToDatabase();
  return LibraryVisit.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("studentId", "name studentId department")
    .lean();
}

export async function listVisitsForStudent(studentObjectId: string) {
  await connectToDatabase();
  return LibraryVisit.find({ studentId: studentObjectId }).sort({ entryDate: -1 }).lean();
}
