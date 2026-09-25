"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { payFineSchema } from "@/validators/transactions";
import Fine from "@/models/Fine";
import Student from "@/models/Student";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN"] as const;

export async function listFines(opts: { studentId?: string; status?: string; page?: number; pageSize?: number }) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;

  if (opts.studentId) {
    const student = await Student.findOne({ studentId: opts.studentId });
    filter.studentId = student?._id ?? null;
  }

  const [fines, total] = await Promise.all([
    Fine.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("studentId", "name studentId")
      .lean(),
    Fine.countDocuments(filter),
  ]);

  return { fines, total, page, pageSize };
}

export async function listOwnFines(studentId: string) {
  const session = await requireRole(["STUDENT"]);
  assertOwnStudentRecord(session, studentId);

  await connectToDatabase();
  const student = await Student.findOne({ studentId });
  if (!student) return [];
  return Fine.find({ studentId: student._id }).sort({ createdAt: -1 }).lean();
}

export async function payFineAction(formData: FormData) {
  await requireRole([...STAFF_ROLES]);
  const parsed = payFineSchema.safeParse({
    fineId: formData.get("fineId"),
    amount: Number(formData.get("amount")),
    paymentMethod: formData.get("paymentMethod") || "cash",
    paymentReference: formData.get("paymentReference") || undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/fines?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { fineId, amount, paymentMethod, paymentReference } = parsed.data;

  await connectToDatabase();
  const fine = await Fine.findOne({ fineId });
  if (!fine) redirect(`/admin/fines?error=${encodeURIComponent("Fine not found.")}`);

  const remaining = fine!.amount; // `amount` always holds the outstanding balance

  if (amount >= remaining) {
    fine!.status = "PAID";
  } else {
    fine!.amount = remaining - amount;
    fine!.status = "PARTIALLY_PAID";
  }
  fine!.paidAt = new Date();
  fine!.paymentMethod = paymentMethod;
  fine!.paymentReference = paymentReference ?? "";
  await fine!.save();

  revalidatePath("/admin/fines");
  redirect("/admin/fines");
}

export async function waiveFineAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
  const fineId = String(formData.get("fineId"));
  const notes = String(formData.get("notes") || "");

  await connectToDatabase();
  await Fine.updateOne(
    { fineId },
    { $set: { status: "WAIVED", waivedBy: session.userId, notes } }
  );

  revalidatePath("/admin/fines");
  redirect("/admin/fines");
}
