import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-white border-slate-200 text-slate-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-red-50 border-red-200 text-red-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
