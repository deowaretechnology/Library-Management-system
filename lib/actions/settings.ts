"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import { librarySettingsSchema } from "@/validators/transactions";
import LibrarySettings from "@/models/LibrarySettings";
import AuditLog from "@/models/AuditLog";

/**
 * Public on purpose — the landing page shows the library's name/contact details, and the
 * rest (loan period, fine per day) is policy students are meant to know anyway.
 */
export async function getSettings() {
  await connectToDatabase();
  return (await LibrarySettings.findOne().lean()) ?? (await LibrarySettings.create({})).toObject();
}

/** Missing field → undefined (keeps the stored value); present → Number, so 0 stays 0. */
function num(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return undefined;
  return Number(raw);
}

export async function updateSettingsAction(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  await connectToDatabase();
  const current: any = (await LibrarySettings.findOne().lean()) ?? (await LibrarySettings.create({})).toObject();

  // Previously the zod schema was never applied server-side and `||` defaults silently
  // rewrote legitimate zeros (fine per day 0 → 5, max renewals 0 → 2) and let negatives
  // through (a negative finePerDay created negative fines).
  const parsed = librarySettingsSchema.safeParse({
    libraryName: String(formData.get("libraryName") ?? current.libraryName ?? "").trim() || "College Library",
    libraryEmail: String(formData.get("libraryEmail") ?? "").trim(),
    libraryPhone: String(formData.get("libraryPhone") ?? "").trim(),
    libraryAddress: String(formData.get("libraryAddress") ?? "").trim(),
    borrowingDurationDays: num(formData, "borrowingDurationDays") ?? current.borrowingDurationDays,
    maxBooksPerStudent: num(formData, "maxBooksPerStudent") ?? current.maxBooksPerStudent,
    finePerDay: num(formData, "finePerDay") ?? current.finePerDay,
    gracePeriodDays: num(formData, "gracePeriodDays") ?? current.gracePeriodDays,
    maxRenewals: num(formData, "maxRenewals") ?? current.maxRenewals,
    maxFineAmount: num(formData, "maxFineAmount") ?? current.maxFineAmount,
    allowRenewal: formData.get("allowRenewal") === "on",
  });
  if (!parsed.success) {
    redirect(`/admin/settings?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await LibrarySettings.findOneAndUpdate({}, { $set: parsed.data }, { upsert: true });

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "SETTINGS_UPDATED",
    entityType: "LibrarySettings",
    entityId: "singleton",
    previousValue: {
      borrowingDurationDays: current.borrowingDurationDays,
      maxBooksPerStudent: current.maxBooksPerStudent,
      finePerDay: current.finePerDay,
      gracePeriodDays: current.gracePeriodDays,
      maxRenewals: current.maxRenewals,
      maxFineAmount: current.maxFineAmount,
      allowRenewal: current.allowRenewal,
    },
    newValue: parsed.data,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
  redirect("/admin/settings");
}
