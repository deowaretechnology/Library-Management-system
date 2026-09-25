import { IssueForm } from "@/components/forms/IssueForm";

export default async function AdminIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Quick Issue</h1>
      <p className="text-sm text-slate-500">Scan the student&apos;s QR to pull up their profile, then scan the book&apos;s QR to issue it.</p>

      {success && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Book issued successfully.</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(error)}</p>}

      <IssueForm />
    </div>
  );
}
