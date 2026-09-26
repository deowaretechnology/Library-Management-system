import { describe, it, expect } from "vitest";
import { toCSV } from "@/lib/csv";

describe("toCSV", () => {
  it("writes a header row followed by one row per record", () => {
    const csv = toCSV(
      [{ name: "Raj", amount: 5 }],
      [
        { key: "name", header: "Name" },
        { key: "amount", header: "Amount" },
      ]
    );
    expect(csv).toBe("Name,Amount\nRaj,5");
  });

  it("quotes and escapes values containing commas or quotes", () => {
    const csv = toCSV([{ note: 'Says "hi", bye' }], [{ key: "note", header: "Note" }]);
    expect(csv).toBe('Note\n"Says ""hi"", bye"');
  });

  it("renders missing values as an empty cell", () => {
    const csv = toCSV([{ name: "Raj" }], [{ key: "missing", header: "Missing" }]);
    expect(csv).toBe("Missing\n");
  });

  it("neutralises spreadsheet formulas in text cells (CSV injection)", () => {
    const csv = toCSV([{ name: "=HYPERLINK(\"http://x\")", n: -5 }], [
      { key: "name", header: "Name" },
      { key: "n", header: "N" },
    ]);
    expect(csv).toBe('Name,N\n"\'=HYPERLINK(""http://x"")",-5');
  });
});
