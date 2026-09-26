/** Cells starting with these are executed as formulas by Excel/Sheets ("CSV injection"). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function toCSV(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const escape = (val: unknown) => {
    let s = val === null || val === undefined ? "" : String(val);
    // A student named "=HYPERLINK(...)" would otherwise run as a formula when staff open the
    // export. Only strings are neutralised — real numbers (incl. negatives) stay numeric.
    if (typeof val === "string" && FORMULA_PREFIX.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = columns.map((c) => escape(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}
