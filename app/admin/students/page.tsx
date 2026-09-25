import { listStudents } from "@/lib/actions/students";
import { CreateStudentForm } from "@/components/forms/CreateStudentForm";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import Link from "next/link";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; page?: string }>;
}) {
  const { q, error, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const { students, total, pageSize } = await listStudents({ query: q, page: currentPage });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Students ({total})</h1>
      </div>

      <form className="flex gap-2" action="/admin/students">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, Student ID, or Library ID"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Search</button>
      </form>

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a student</summary>
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateStudentForm />
      </details>

      <DataTable
        rows={students as any[]}
        emptyMessage="No students yet — add one above."
        columns={[
          { header: "Name", cell: (r: any) => <Link href={`/admin/students/${r.studentId}`} className="text-brand-600 hover:underline">{r.name}</Link> },
          { header: "Student ID", cell: (r: any) => r.studentId },
          { header: "Library ID", cell: (r: any) => r.libraryId },
          { header: "Department", cell: (r: any) => r.department },
          { header: "Status", cell: (r: any) => <StatusBadge status={r.status} /> },
        ]}
      />

      <Pagination page={currentPage} pageSize={pageSize} total={total} basePath="/admin/students" extraParams={{ q }} />
    </div>
  );
}
