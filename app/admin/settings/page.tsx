import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/actions/settings";
import { SettingsForm } from "@/components/forms/SettingsForm";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();
  const settings: any = await getSettings();

  if (session?.role !== "SUPER_ADMIN") {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Only a Super Admin can change library settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Library Settings</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <SettingsForm
        defaults={{
          libraryName: settings.libraryName ?? "",
          libraryEmail: settings.libraryEmail ?? "",
          libraryPhone: settings.libraryPhone ?? "",
          libraryAddress: settings.libraryAddress ?? "",
          borrowingDurationDays: settings.borrowingDurationDays,
          maxBooksPerStudent: settings.maxBooksPerStudent,
          finePerDay: settings.finePerDay,
          gracePeriodDays: settings.gracePeriodDays,
          maxRenewals: settings.maxRenewals,
          maxFineAmount: settings.maxFineAmount,
          allowRenewal: settings.allowRenewal,
        }}
      />
    </div>
  );
}
