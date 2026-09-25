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

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN"] as const;

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

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.query) {
    filter.$or = [
      { name: { $regex: opts.query, $options: "i" } },
      { studentId: { $regex: opts.query, $options: "i" } },
      { libraryId: { $regex: opts.query, $options: "i" } },
    ];
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
  await requireRole([...STAFF_ROLES]);
  const studentId = String(formData.get("studentId"));
  const status = String(formData.get("status"));

  await connectToDatabase();
  await Student.updateOne({ studentId }, { $set: { status } });

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

  const student: any = await Student.findOne({ studentId: studentId.trim() }).lean();
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
  await connectToDatabase();
  const student: any = await Student.findOne({ studentId }).lean();
  if (!student) return null;

  const [activeBorrows, allBorrows, fines] = await Promise.all([
    BorrowTransaction.find({ studentId: student._id, status: "ACTIVE" }).lean(),
    BorrowTransaction.find({ studentId: student._id }).sort({ issueDate: -1 }).limit(50).lean(),
    Fine.find({ studentId: student._id }).sort({ createdAt: -1 }).lean(),
  ]);

  return { student, activeBorrows, allBorrows, fines };
}

/** CLEARED only if no active books, no pending/partial fines, no unresolved lost/damaged copies. */
export async function getClearanceStatus(studentId: string, sessionStudentIdOwnershipCheck?: string) {
  await connectToDatabase();
  const student = await Student.findOne({ studentId });
  if (!student) throw new Error("Student not found.");
  if (sessionStudentIdOwnershipCheck) {
    const session = await requireRole(["STUDENT", "SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
    assertOwnStudentRecord(session, sessionStudentIdOwnershipCheck);
  }

  const [activeCount, pendingFines] = await Promise.all([
    BorrowTransaction.countDocuments({ studentId: student._id, status: "ACTIVE" }),
    Fine.countDocuments({ studentId: student._id, status: { $in: ["PENDING", "PARTIALLY_PAID"] } }),
  ]);

  return evaluateClearance({ activeBorrowCount: activeCount, pendingFineCount: pendingFines });
}
