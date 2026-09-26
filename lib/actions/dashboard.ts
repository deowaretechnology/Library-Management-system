"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import LibraryVisit from "@/models/LibraryVisit";
import AuditLog from "@/models/AuditLog";

export async function getDashboardStats() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalStudents,
    totalCopies,
    availableCopies,
    issuedCopies,
    overdueCount,
    todayIssueCount,
    todayReturnCount,
    lostDamagedCount,
    currentlyInside,
    pendingFineAgg,
  ] = await Promise.all([
    Student.countDocuments({}),
    BookCopy.countDocuments({}),
    BookCopy.countDocuments({ status: "AVAILABLE" }),
    BookCopy.countDocuments({ status: "ISSUED" }),
    BorrowTransaction.countDocuments({ status: "ACTIVE", dueDate: { $lt: new Date() } }),
    BorrowTransaction.countDocuments({ issueDate: { $gte: startOfToday } }),
    BorrowTransaction.countDocuments({ returnDate: { $gte: startOfToday } }),
    BookCopy.countDocuments({ status: { $in: ["LOST", "DAMAGED"] } }),
    LibraryVisit.countDocuments({ status: "INSIDE" }),
    Fine.aggregate([
      { $match: { status: { $in: ["PENDING", "PARTIALLY_PAID"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    totalStudents,
    totalCopies,
    availableCopies,
    issuedCopies,
    overdueCount,
    todayIssueCount,
    todayReturnCount,
    lostDamagedCount,
    currentlyInside,
    pendingFineTotal: pendingFineAgg[0]?.total ?? 0,
  };
}

export async function getRecentActivity(limit = 8) {
  await connectToDatabase();
  const [recentIssues, recentReturns] = await Promise.all([
    BorrowTransaction.find({}).sort({ issueDate: -1 }).limit(limit).populate("studentId", "name studentId").lean(),
    BorrowTransaction.find({ status: "RETURNED" })
      .sort({ returnDate: -1 })
      .limit(limit)
      .populate("studentId", "name studentId")
      .lean(),
  ]);
  return { recentIssues, recentReturns };
}

export async function getOverdueTransactions() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();
  return BorrowTransaction.find({ status: "ACTIVE", dueDate: { $lt: new Date() } })
    .sort({ dueDate: 1 })
    .populate("studentId", "name studentId phone")
    .lean();
}

// All currently-issued copies (overdue or not) with who holds them — same
// "who has what" info already visible on the Issue Book/Return Book pages,
// so it's fair game for the staff-facing AI assistant's context too.
export async function getActiveTransactions(limit = 60) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();
  return BorrowTransaction.find({ status: "ACTIVE" })
    .sort({ dueDate: 1 })
    .limit(limit)
    .populate("studentId", "name studentId phone")
    .lean();
}

export async function getDueSoonTransactions() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  return BorrowTransaction.find({ status: "ACTIVE", dueDate: { $gte: new Date(), $lte: soon } })
    .sort({ dueDate: 1 })
    .populate("studentId", "name studentId")
    .lean();
}

export async function listAuditLogs(page = 1, pageSize = 30) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();

  const [logs, total] = await Promise.all([
    AuditLog.find({})
      .sort({ timestamp: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "name role")
      .lean(),
    AuditLog.countDocuments({}),
  ]);

  return { logs, total, page, pageSize };
}

/** Issues per day for the last 7 days — feeds the dashboard trend chart. */
export async function getIssuesTrend(days = 7) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await BorrowTransaction.aggregate([
    { $match: { issueDate: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$issueDate" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDate = new Map(rows.map((r: any) => [r._id, r.count]));
  const result: { day: string; issues: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), issues: byDate.get(key) ?? 0 });
  }
  return result;
}
