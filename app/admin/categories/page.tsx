import { listCategories } from "@/lib/actions/catalog";
import { CreateCategoryForm } from "@/components/forms/CreateCategoryForm";
import { DataTable } from "@/components/DataTable";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;
  const categories = await listCategories();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Categories ({categories.length})</h1>

      <details className="rounded-xl border border-slate-200 bg-white p-4" open={Boolean(error)}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Add a category</summary>
        {created && <p className="mt-3 text-sm text-emerald-600">Category added and published.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{decodeURIComponent(error)}</p>}
        <CreateCategoryForm />
      </details>

      <DataTable
        rows={categories as any[]}
        emptyMessage="No categories yet — add one above."
        columns={[
          { header: "Name", cell: (r: any) => r.name },
          { header: "Description", cell: (r: any) => r.description ?? "—" },
          { header: "Books", cell: (r: any) => r.bookCount },
        ]}
      />
    </div>
  );
}
