import { getSession } from "@/lib/auth/session";
import { getClearanceStatus } from "@/lib/actions/students";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default async function StudentClearancePage() {
  const session = await getSession();
  const { cleared, reasons } = await getClearanceStatus(session!.studentId!, session!.studentId!);

  return (
    <div className="max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Library Clearance</h1>
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${cleared ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        {cleared ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div>
          <p className={`font-medium ${cleared ? "text-emerald-900" : "text-amber-900"}`}>
            {cleared ? "Cleared" : "Clearance pending"}
          </p>
          {!cleared && (
            <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
