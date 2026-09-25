import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function toPDF(
  title: string,
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[]
): Buffer {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `College Library Management System · Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
