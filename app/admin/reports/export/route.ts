import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { toCSV } from "@/lib/csv";
import { toPDF } from "@/lib/pdf";
import {
  getStudentReport,
  getInventoryReport,
  getClearanceReport,
  getMostBorrowedBooks,
  getIssueReport,
  getReturnReport,
  getLostDamagedReport,
  getEntryExitReport,
  getMostActiveStudents,
} from "@/lib/actions/reports";
import { getOverdueTransactions } from "@/lib/actions/dashboard";
import { listFines } from "@/lib/actions/fines";
import { formatIstDate } from "@/lib/domain/dates";

type ReportDef = { title: string; rows: any[]; columns: { key: string; header: string }[] };

const REPORTS: Record<string, () => Promise<ReportDef>> = {
  students: async () => ({
    title: "Student Report",
    rows: await getStudentReport(),
    columns: [
      { key: "name", header: "Name" },
      { key: "studentId", header: "Student ID" },
      { key: "department", header: "Department" },
      { key: "status", header: "Status" },
      { key: "activeBorrowCount", header: "Active Borrows" },
      { key: "pendingFineTotal", header: "Pending Fine" },
    ],
  }),
  inventory: async () => ({
    title: "Inventory Report",
    rows: (await getInventoryReport()).map((r: any) => ({ status: r._id, count: r.count })),
    columns: [
      { key: "status", header: "Status" },
      { key: "count", header: "Count" },
    ],
  }),
  clearance: async () => ({
    title: "Clearance Report",
    rows: await getClearanceReport(),
    columns: [
      { key: "name", header: "Name" },
      { key: "studentId", header: "Student ID" },
      { key: "department", header: "Department" },
      { key: "eligible", header: "Eligible" },
      { key: "confirmed", header: "Confirmed" },
    ],
  }),
  overdue: async () => ({
    title: "Overdue Report",
    rows: (await getOverdueTransactions()).map((t: any) => ({
      student: t.studentId?.name,
      studentId: t.studentId?.studentId,
      dueDate: formatIstDate(t.dueDate),
    })),
    columns: [
      { key: "student", header: "Student" },
      { key: "studentId", header: "Student ID" },
      { key: "dueDate", header: "Due Date" },
    ],
  }),
  fines: async () => {
    const { fines } = await listFines({ pageSize: 1000 });
    return {
      title: "Fine Collection Report",
      rows: fines.map((f: any) => ({
        student: f.studentId?.name,
        amount: f.amount,
        reason: f.reason,
        status: f.status,
      })),
      columns: [
        { key: "student", header: "Student" },
        { key: "amount", header: "Amount" },
        { key: "reason", header: "Reason" },
        { key: "status", header: "Status" },
      ],
    };
  },
  "most-borrowed": async () => ({
    title: "Most Borrowed Books",
    rows: (await getMostBorrowedBooks(50)).map((r: any) => ({ sanityBookId: r._id, borrowCount: r.borrowCount })),
    columns: [
      { key: "sanityBookId", header: "Sanity Book ID" },
      { key: "borrowCount", header: "Times Borrowed" },
    ],
  }),
  issues: async () => ({
    title: "Issue Report (last 30 days)",
    rows: (await getIssueReport()).map((t: any) => ({
      student: t.studentId?.name,
      studentId: t.studentId?.studentId,
      issueDate: formatIstDate(t.issueDate),
      dueDate: formatIstDate(t.dueDate),
      status: t.status,
    })),
    columns: [
      { key: "student", header: "Student" },
      { key: "studentId", header: "Student ID" },
      { key: "issueDate", header: "Issue Date" },
      { key: "dueDate", header: "Due Date" },
      { key: "status", header: "Status" },
    ],
  }),
  returns: async () => ({
    title: "Return Report (last 30 days)",
    rows: (await getReturnReport()).map((t: any) => ({
      student: t.studentId?.name,
      studentId: t.studentId?.studentId,
      returnDate: t.returnDate ? formatIstDate(t.returnDate) : "",
    })),
    columns: [
      { key: "student", header: "Student" },
      { key: "studentId", header: "Student ID" },
      { key: "returnDate", header: "Return Date" },
    ],
  }),
  "lost-damaged": async () => ({
    title: "Lost / Damaged Report",
    rows: (await getLostDamagedReport()).map((c: any) => ({
      copyId: c.copyId,
      barcode: c.barcode,
      status: c.status,
      notes: c.notes ?? "",
    })),
    columns: [
      { key: "copyId", header: "Copy ID" },
      { key: "barcode", header: "Barcode" },
      { key: "status", header: "Status" },
      { key: "notes", header: "Notes" },
    ],
  }),
  "entry-exit": async () => ({
    title: "Entry / Exit Report (last 30 days)",
    rows: (await getEntryExitReport()).map((v: any) => ({
      student: v.studentId?.name,
      studentId: v.studentId?.studentId,
      entry: `${formatIstDate(v.entryDate)} ${v.entryTime}`,
      exit: v.exitTime ?? "",
      status: v.status,
    })),
    columns: [
      { key: "student", header: "Student" },
      { key: "studentId", header: "Student ID" },
      { key: "entry", header: "Entry" },
      { key: "exit", header: "Exit" },
      { key: "status", header: "Status" },
    ],
  }),
  "most-active": async () => ({
    title: "Most Active Students",
    rows: (await getMostActiveStudents(50)).map((r: any) => ({
      name: r.student?.name,
      studentId: r.student?.studentId,
      borrows: r.borrows,
      visits: r.visits,
      total: r.total,
    })),
    columns: [
      { key: "name", header: "Name" },
      { key: "studentId", header: "Student ID" },
      { key: "borrows", header: "Borrows" },
      { key: "visits", header: "Visits" },
      { key: "total", header: "Total Activity" },
    ],
  }),
};

export async function GET(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  } catch (err) {
    unstable_rethrow(err);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "";
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const report = REPORTS[type];
  if (!report) {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  const { title, rows, columns } = await report();

  if (format === "pdf") {
    const pdf = toPDF(title, rows, columns);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}-report.pdf"`,
      },
    });
  }

  // Leading BOM so Excel opens it as UTF-8 (₹ and non-ASCII names otherwise show garbled).
  const csv = "\uFEFF" + toCSV(rows, columns);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-report.csv"`,
    },
  });
}
