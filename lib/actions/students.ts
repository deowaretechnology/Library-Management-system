"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { hashPassword } from "@/lib/auth/password";
import { createStudentSchema } from "@/validators/transactions";
import { evaluateClearance } from "@/lib/domain/clearance";
import User from "@/models/User";
import Student from "@/models/Student";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import LibrarySettings from "@/models/LibrarySettings";
import AuditLog from "@/models/AuditLog";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN"] as const;
const ALL_ROLES = ["STUDENT", "SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;
const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED", "BLOCKED"];

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createStudentAction(formData: FormData) {
  await requireRole([...STAFF_ROLES]);

  const parsed = createStudentSchema.safeParse({
    name: formData.get("name"),
    studentId: formData.get("studentId"),
    libraryId: formData.get("libraryId"),
    enrollmentNo: formData.get("enrollmentNo"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    department: formData.get("department"),
    course: formData.get("course"),
    semester: Number(formData.get("semester")),
    academicYear: formData.get("academicYear"),
  });

  if (!parsed.success) {
    redirect(`/admin/students?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await connectToDatabase();

  const existing = await Student.findOne({
    $or: [{ studentId: parsed.data.studentId }, { libraryId: parsed.data.libraryId }],
  });
  if (existing) {
    redirect(`/admin/students?error=${encodeURIComponent("Duplicate Student ID or Library ID.")}`);
  }

  // Default password is the Library ID — the student is expected to change it on first login.
  const passwordHash = await hashPassword(parsed.data.libraryId);

  const user = await User.create({
    role: "STUDENT",
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name,
    status: "ACTIVE",
  });

  const student = await Student.create({ ...parsed.data, userId: user._id });
  user.studentProfile = student._id;
  await user.save();

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function listStudents(opts: {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const page = Math.max(1, Math.floor(Number(opts.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(opts.pageSize) || 20)));
  const filter: Record<string, unknown> = {};
  if (opts.status && STUDENT_STATUSES.includes(String(opts.status))) filter.status = String(opts.status);
  const q = opts.query ? String(opts.query).trim().slice(0, 64) : "";
  if (q) {
    // Escaped: raw input like "(" used to crash the page, and a crafted pattern could hang the DB.
    const rx = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [{ name: rx }, { studentId: rx }, { libraryId: rx }];
  }

  const [students, total] = await Promise.all([
    Student.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Student.countDocuments(filter),
  ]);

  return { students, total, page, pageSize };
}

export async function updateStudentStatusAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "");
  // updateOne skips enum validation — any string used to be writable as a status.
  if (!STUDENT_STATUSES.includes(status)) {
    redirect(`/admin/students?error=${encodeURIComponent("Invalid status.")}`);
  }

  await connectToDatabase();
  const before = await Student.findOneAndUpdate({ studentId }, { $set: { status } }, { new: false }).lean<any>();
  if (before && before.status !== status) {
    await AuditLog.create({
      userId: session.userId,
      role: session.role,
      action: "STUDENT_STATUS_CHANGED",
      entityType: "Student",
      entityId: studentId,
      previousValue: { status: before.status },
      newValue: { status },
    });
  }

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function confirmClearanceAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
  const studentId = String(formData.get("studentId"));

  await connectToDatabase();
  const { cleared } = await getClearanceStatus(studentId);
  if (!cleared) redirect(`/admin/students/${studentId}?error=${encodeURIComponent("Cannot confirm clearance — outstanding books or fines remain.")}`);

  await Student.updateOne(
    { studentId },
    { $set: { clearanceConfirmedAt: new Date(), clearanceConfirmedBy: session.userId } }
  );

  revalidatePath(`/admin/students/${studentId}`);
  redirect(`/admin/students/${studentId}?cleared=1`);
}

export type StudentIssueProfile = {
  studentId: string;
  libraryId: string;
  name: string;
  department: string;
  semester: number;
  status: string;
  activeCount: number;
  maxBooksPerStudent: number;
  pendingFineCount: number;
  eligible: boolean;
  ineligibleReason?: string;
};

/**
 * Lightweight lookup for the "scan student QR, then scan book QR" issue flow at the counter —
 * just enough to show the librarian who this is and whether they can borrow, before scanning
 * the book. Returns null (not an error) for an unrecognized ID, same as a barcode miss.
 */
export async function getStudentIssueProfileAction(studentId: string): Promise<StudentIssueProfile | null> {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const student: any = await Student.findOne({ studentId: String(studentId).trim() }).lean();
  if (!student) return null;

  const settings: any = (await LibrarySettings.findOne().lean()) ?? { maxBooksPerStudent: 3 };
  const [activeCount, pendingFineCount] = await Promise.all([
    BorrowTransaction.countDocuments({ studentId: student._id, status: "ACTIVE" }),
    Fine.countDocuments({ studentId: student._id, status: { $in: ["PENDING", "PARTIALLY_PAID"] } }),
  ]);

  let ineligibleReason: string | undefined;
  if (student.status !== "ACTIVE") ineligibleReason = `Account is ${student.status.toLowerCase()}.`;
  else if (activeCount >= settings.maxBooksPerStudent) ineligibleReason = "Reached the maximum borrowing limit.";
  else if (pendingFineCount > 0) ineligibleReason = "Has an outstanding fine.";

  return {
    studentId: student.studentId,
    libraryId: student.libraryId,
    name: student.name,
    department: student.department,
    semester: student.semester,
    status: student.status,
    activeCount,
    maxBooksPerStudent: settings.maxBooksPerStudent,
    pendingFineCount,
    eligible: !ineligibleReason,
    ineligibleReason,
  };
}

export async function getStudentDetail(studentId: string) {
  // Previously had NO auth check at all — as a server action it was directly callable and
  // returned any student's full record (email, phone, loans, fines) to anyone.
  const session = await requireRole([...ALL_ROLES]);
  assertOwnStudentRecord(session, String(studentId));

  await connectToDatabase();
  const student: any = await Student.findOne({ studentId: String(studentId) }).lean();
  if (!student) return null;

  const [activeBorrows, allBorrows, fines] = await Promise.all([
    BorrowTransaction.find({ studentId: student._id, status: "ACTIVE" }).lean(),
    BorrowTransaction.find({ studentId: student._id }).sort({ issueDate: -1 }).limit(50).lean(),
    Fine.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);

  return { student, activeBorrows, allBorrows, fines };
}

/** CLEARED only if no active books, no pending/partial fines, no unresolved lost/damaged copies. */
export async function getClearanceStatus(studentId: string, _legacyOwnershipArg?: string) {
  // Auth is now unconditional — it used to run only when the 2nd argument was passed.
  const session = await requireRole([...ALL_ROLES]);
  assertOwnStudentRecord(session, String(studentId));

  await connectToDatabase();
  const student = await Student.findOne({ studentId: String(studentId) }).select("_id").lean<any>();
  if (!student) throw new Error("Student not found.");

  const [activeCount, pendingFines] = await Promise.all([
    BorrowTransaction.countDocuments({ studentId: student._id, status: "ACTIVE" }),
    Fine.countDocuments({ studentId: student._id, status: { $in: ["PENDING", "PARTIALLY_PAID"] } }),
  ]);

  return evaluateClearance({ activeBorrowCount: activeCount, pendingFineCount: pendingFines });
}
