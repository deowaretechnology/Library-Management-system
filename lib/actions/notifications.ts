"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { runDueSoonSweepCore } from "@/lib/notifications/sweep";
import Notification from "@/models/Notification";
import Student from "@/models/Student";

export async function listOwnNotifications(studentId: string) {
  const session = await requireRole(["STUDENT"]);
  assertOwnStudentRecord(session, studentId);

  await connectToDatabase();
  const student = await Student.findOne({ studentId });
  if (!student) return [];
  return Notification.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(50).lean();
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await requireRole(["STUDENT"]);
  const studentId = String(formData.get("studentId"));
  assertOwnStudentRecord(session, studentId);

  await connectToDatabase();
  const student = await Student.findOne({ studentId });
  if (student) await Notification.updateMany({ studentId: student._id, read: false }, { $set: { read: true } });

  revalidatePath("/student/notifications");
}

/**
 * Finds ACTIVE transactions due soon or overdue and creates a notification for each,
 * skipping any transaction that already got one in the last 20 hours so re-running this
 * (e.g. from a scheduled Vercel Cron job hitting an API route that calls this) doesn't spam.
 * There's no scheduler wired up in this project yet — call this from a cron endpoint,
 * or trigger it manually from /admin/reports for now.
 */
export async function runDueSoonSweep() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  return runDueSoonSweepCore();
}

export async function runDueSoonSweepAction() {
  const result = await runDueSoonSweep();
  revalidatePath("/admin/reports");
  redirect(`/admin/reports?swept=${result.sent}&checked=${result.checked}`);
}
