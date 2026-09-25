"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import { hashPassword } from "@/lib/auth/password";
import { createStaffSchema } from "@/validators/staff";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";

/**
 * Staff accounts (Librarian / Library Staff) are only ever created here, by a Super Admin —
 * there's no self-registration for this side, unlike students. Kept separate from
 * lib/actions/students.ts on purpose: different schema, different permission bar (only
 * SUPER_ADMIN, not LIBRARIAN, may manage other staff accounts).
 */

export async function createStaffAction(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/admin/staff?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await connectToDatabase();

  const existing = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (existing) {
    redirect(`/admin/staff?error=${encodeURIComponent("An account with this email already exists.")}`);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const staff = await User.create({
    role: parsed.data.role,
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    name: parsed.data.name,
    status: "ACTIVE",
  });

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "STAFF_CREATED",
    entityType: "User",
    entityId: staff._id.toString(),
    newValue: { name: staff.name, email: staff.email, role: staff.role },
  });

  revalidatePath("/admin/staff");
  redirect(`/admin/staff?created=${encodeURIComponent(staff.email)}`);
}

export async function listStaff() {
  await requireRole(["SUPER_ADMIN"]);
  await connectToDatabase();

  return User.find({ role: { $in: ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] } })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Soft delete only — staff accounts stay in every BorrowTransaction.issuedBy / AuditLog.userId
 * they ever touched, so hard-deleting one would leave "who issued this book" pointing at
 * nothing. Deactivating blocks login (see login() in lib/actions/auth.ts, which already
 * refuses any non-ACTIVE account) while keeping that history intact and reversible.
 */
export async function toggleStaffStatusAction(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect("/admin/staff?error=Missing%20account.");

  await connectToDatabase();
  const target = await User.findById(userId);
  if (!target || !["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"].includes(target.role)) {
    redirect(`/admin/staff?error=${encodeURIComponent("Account not found.")}`);
  }

  if (String(target!._id) === session.userId) {
    redirect(`/admin/staff?error=${encodeURIComponent("You can't deactivate your own account.")}`);
  }

  const nextStatus = target!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  if (nextStatus === "INACTIVE" && target!.role === "SUPER_ADMIN") {
    const activeSuperAdmins = await User.countDocuments({ role: "SUPER_ADMIN", status: "ACTIVE" });
    if (activeSuperAdmins <= 1) {
      redirect(`/admin/staff?error=${encodeURIComponent("At least one active Super Admin must remain.")}`);
    }
  }

  const previousStatus = target!.status;
  target!.status = nextStatus;
  await target!.save();

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: nextStatus === "ACTIVE" ? "STAFF_REACTIVATED" : "STAFF_DEACTIVATED",
    entityType: "User",
    entityId: String(target!._id),
    previousValue: { status: previousStatus },
    newValue: { status: nextStatus },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}
