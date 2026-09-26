"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { payFineSchema } from "@/validators/transactions";
import Fine from "@/models/Fine";
import Student from "@/models/Student";
import AuditLog from "@/models/AuditLog";

const FINE_STATUSES = ["PENDING", "PARTIALLY_PAID", "PAID", "WAIVED", "CANCELLED"];
const OUTSTANDING = ["PENDING", "PARTIALLY_PAID"];

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN"] as const;

export async function listFines(opts: { studentId?: string; status?: string; page?: number; pageSize?: number }) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const filter: Record<string, unknown> = {};
  if (opts.status && FINE_STATUSES.includes(String(opts.status))) filter.status = String(opts.status);

  if (opts.studentId) {
    const student = await Student.findOne({ studentId: String(opts.studentId) }).select("_id").lean<any>();
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
  const student = await Student.findOne({ studentId }).select("_id").lean<any>();
  if (!student) return [];
  return Fine.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(200).lean();
}

export async function payFineAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
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
  const fine = await Fine.findOne({ fineId }).lean<any>();
  if (!fine) redirect(`/admin/fines?error=${encodeURIComponent("Fine not found.")}`);
  // A PAID or WAIVED fine could previously be "paid" again, or have its amount reduced.
  if (!OUTSTANDING.includes(fine.status)) {
    redirect(`/admin/fines?error=${encodeURIComponent("This fine is already settled.")}`);
  }

  const remaining = fine.amount; // `amount` always holds the outstanding balance
  const paid = Math.min(amount, remaining);
  const fullyPaid = paid >= remaining;

  // Conditional on the balance we just read: a double-submitted payment (or a counter
  // payment racing the Razorpay webhook) can no longer apply twice.
  const updated = await Fine.findOneAndUpdate(
    { fineId, status: { $in: OUTSTANDING }, amount: remaining },
    {
      $set: {
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        ...(fullyPaid ? {} : { amount: remaining - paid }),
        paidAt: new Date(),
        paymentMethod,
        paymentReference: paymentReference ?? "",
      },
      $inc: { amountPaid: paid },
    },
    { new: true }
  );
  if (!updated) {
    redirect(`/admin/fines?error=${encodeURIComponent("This fine was just updated by someone else — refresh and try again.")}`);
  }

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: fullyPaid ? "FINE_PAID" : "FINE_PARTIALLY_PAID",
    entityType: "Fine",
    entityId: fineId,
    previousValue: { status: fine.status, amount: remaining },
    newValue: { status: updated.status, amount: updated.amount, paid, paymentMethod },
  });

  revalidatePath("/admin/fines");
  redirect("/admin/fines");
}

export async function waiveFineAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
  const fineId = String(formData.get("fineId") ?? "");
  const notes = String(formData.get("notes") || "").slice(0, 500);

  await connectToDatabase();
  // Only an outstanding fine can be waived — waiving a PAID one used to erase the payment record.
  const before = await Fine.findOneAndUpdate(
    { fineId, status: { $in: OUTSTANDING } },
    { $set: { status: "WAIVED", waivedBy: session.userId, notes } },
    { new: false }
  );
  if (before) {
    await AuditLog.create({
      userId: session.userId,
      role: session.role,
      action: "FINE_WAIVED",
      entityType: "Fine",
      entityId: fineId,
      previousValue: { status: before.status, amount: before.amount },
      newValue: { status: "WAIVED", notes },
    });
  }

  revalidatePath("/admin/fines");
  redirect("/admin/fines");
}
