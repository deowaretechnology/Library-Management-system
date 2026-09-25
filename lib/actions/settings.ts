"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import LibrarySettings from "@/models/LibrarySettings";

export async function getSettings() {
  await connectToDatabase();
  return (await LibrarySettings.findOne().lean()) ?? (await LibrarySettings.create({})).toObject();
}

export async function updateSettingsAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  await connectToDatabase();

  const update = {
    libraryName: String(formData.get("libraryName") || "College Library"),
    libraryEmail: String(formData.get("libraryEmail") || ""),
    libraryPhone: String(formData.get("libraryPhone") || ""),
    libraryAddress: String(formData.get("libraryAddress") || ""),
    borrowingDurationDays: Number(formData.get("borrowingDurationDays")) || 7,
    maxBooksPerStudent: Number(formData.get("maxBooksPerStudent")) || 3,
    finePerDay: Number(formData.get("finePerDay")) || 5,
    gracePeriodDays: Number(formData.get("gracePeriodDays")) || 0,
    allowRenewal: formData.get("allowRenewal") === "on",
    maxRenewals: Number(formData.get("maxRenewals")) || 2,
    maxFineAmount: Number(formData.get("maxFineAmount")) || 500,
  };

  await LibrarySettings.findOneAndUpdate({}, { $set: update }, { upsert: true });

  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}
