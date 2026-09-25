export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
};

export function DataTable<T extends { _id?: string }>({
  columns,
  rows,
  emptyMessage = "Nothing to show yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row._id ?? i} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.header} className="px-4 py-3">
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
