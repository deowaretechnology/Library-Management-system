import { ReturnForm } from "@/components/forms/ReturnForm";

export default async function AdminReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; overdueDays?: string; fineAmount?: string; studentName?: string }>;
}) {
  const { error, success, overdueDays, fineAmount, studentName } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Quick Return</h1>
      <p className="text-sm text-slate-500">Scan the book&apos;s QR — it comes off the borrower&apos;s profile and back into the library.</p>

      {success && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          {studentName ? `Returned by ${decodeURIComponent(studentName)} — back` : "Back"} in the library.{" "}
          {Number(overdueDays) > 0
            ? `${overdueDays} day(s) overdue — fine of ₹${fineAmount} recorded.`
            : "On time, no fine."}
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <ReturnForm />
    </div>
  );
}
