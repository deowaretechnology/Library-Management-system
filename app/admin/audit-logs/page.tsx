import { listAuditLogs } from "@/lib/actions/dashboard";
import { DataTable } from "@/components/DataTable";

export default async function AdminAuditLogsPage() {
  const { logs, total } = await listAuditLogs();

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Audit Logs ({total})</h1>
      <DataTable
        rows={logs as any[]}
        emptyMessage="No activity logged yet."
        columns={[
          { header: "When", cell: (r: any) => new Date(r.timestamp).toLocaleString() },
          { header: "Actor", cell: (r: any) => `${r.userId?.name ?? "—"} (${r.role})` },
          { header: "Action", cell: (r: any) => r.action },
          { header: "Entity", cell: (r: any) => `${r.entityType} · ${r.entityId}` },
        ]}
      />
    </div>
  );
}
