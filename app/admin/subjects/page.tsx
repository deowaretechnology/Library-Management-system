import { listSubjects } from "@/lib/actions/catalog";
import { CreateSubjectForm } from "@/components/forms/CreateSubjectForm";
import { DataTable } from "@/components/DataTable";

export default async function AdminSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;
  const subjects = await listSubjects();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Subjects ({subjects.length})</h1>

      <details className="rounded-xl border border-slate-200 bg-white p-4" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a subject</summary>
        {created && <p className="mt-3 text-sm text-emerald-600">Subject added and published.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateSubjectForm />
      </details>

      <DataTable
        rows={subjects as any[]}
        emptyMessage="No subjects yet — add one above."
        columns={[
          { header: "Name", cell: (r: any) => r.name },
          { header: "Description", cell: (r: any) => r.description ?? "—" },
          { header: "Books", cell: (r: any) => r.bookCount },
        ]}
      />
    </div>
  );
}
