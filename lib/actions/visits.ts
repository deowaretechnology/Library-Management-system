"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import Student from "@/models/Student";
import LibraryVisit from "@/models/LibraryVisit";
import { istTimeHHmm, startOfIstDay } from "@/lib/domain/dates";
import { makeId } from "@/lib/domain/ids";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;

/** Scanning a Student ID toggles entry/exit — no open visit creates one, an open one closes it. */
export async function scanEntryExitAction(formData: FormData) {
  await requireRole([...STAFF_ROLES]);
  const studentId = String(formData.get("studentId") ?? "").trim();

  await connectToDatabase();
  const student = await Student.findOne({ studentId }).select("_id").lean<any>();
  if (!student) redirect(`/admin/entry-exit?error=${encodeURIComponent("Invalid or unrecognized Student ID.")}`);

  const now = new Date();
  const openVisit = await LibraryVisit.findOne({ studentId: student._id, status: "INSIDE" }).lean<any>();

  // A visit left open from an EARLIER day (student walked out without scanning) is closed
  // automatically, and today's scan counts as a fresh ENTRY — previously it closed
  // yesterday's visit with a ~24h duration and recorded no entry for today.
  const staleOpenVisit = openVisit && openVisit.entryDate < startOfIstDay(now);

  if (openVisit && !staleOpenVisit) {
    // Atomic close — a double scan can't close it twice.
    await LibraryVisit.updateOne(
      { _id: openVisit._id, status: "INSIDE" },
      {
        $set: {
          exitDate: now,
          exitTime: istTimeHHmm(now),
          exitMethod: "barcode-scan",
          status: "EXITED",
          durationMinutes: Math.round((now.getTime() - new Date(openVisit.entryDate).getTime()) / 60000),
        },
      }
    );
  } else {
    if (staleOpenVisit) {
      await LibraryVisit.updateOne(
        { _id: openVisit._id, status: "INSIDE" },
        { $set: { status: "EXITED", exitMethod: "auto-close (no exit scan)" } }
      );
    }
    try {
      await LibraryVisit.create({
        visitId: makeId("VISIT"),
        studentId: student._id,
        entryDate: now,
        entryTime: istTimeHHmm(now),
        entryMethod: "barcode-scan",
        status: "INSIDE",
      });
    } catch (err: any) {
      // Unique index "one open visit per student": a near-simultaneous double scan already
      // recorded the entry — nothing more to do.
      if (err?.code !== 11000) throw err;
    }
  }

  revalidatePath("/admin/entry-exit");
  redirect("/admin/entry-exit");
}

// These three had no auth check — directly callable, they exposed who is in the library
// and (via an operator payload like {"$ne": null}) every student's visit history.
export async function listCurrentlyInside() {
  await requireRole([...STAFF_ROLES]);
  await connectToDatabase();
  return LibraryVisit.find({ status: "INSIDE", entryDate: { $gte: startOfIstDay() } })
    .sort({ entryDate: -1 })
    .limit(500)
    .populate("studentId", "name studentId department")
    .lean();
}

export async function listRecentVisits(limit = 20) {
  await requireRole([...STAFF_ROLES]);
  await connectToDatabase();
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
  return LibraryVisit.find({})
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate("studentId", "name studentId department")
    .lean();
}

/** A student's own visit log (students can only ever get their own, whatever id is passed). */
export async function listVisitsForStudent(studentObjectId: string) {
  const session = await requireRole(["STUDENT", ...STAFF_ROLES]);
  await connectToDatabase();

  let targetId: string = String(studentObjectId);
  if (session.role === "STUDENT") {
    const own = await Student.findOne({ studentId: session.studentId }).select("_id").lean<any>();
    if (!own) return [];
    targetId = own._id.toString();
  }
  return LibraryVisit.find({ studentId: targetId }).sort({ entryDate: -1 }).limit(200).lean();
}
