const TONE_BY_STATUS: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  ACTIVE: "bg-blue-100 text-blue-800",
  ISSUED: "bg-blue-100 text-blue-800",
  INSIDE: "bg-blue-100 text-blue-800",
  RESERVED: "bg-amber-100 text-amber-800",
  DUE_SOON: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  LOST: "bg-red-100 text-red-800",
  DAMAGED: "bg-red-100 text-red-800",
  REPAIR: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-red-100 text-red-800",
  BLOCKED: "bg-red-100 text-red-800",
  RETURNED: "bg-slate-100 text-slate-700",
  EXITED: "bg-slate-100 text-slate-700",
  ARCHIVED: "bg-slate-100 text-slate-700",
  INACTIVE: "bg-slate-100 text-slate-700",
  GRADUATED: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  WAIVED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-slate-100 text-slate-700",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = TONE_BY_STATUS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
