"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import LibraryVisit from "@/models/LibraryVisit";
import AuditLog from "@/models/AuditLog";
import { startOfIstDay, istDayKey, IST_TIMEZONE } from "@/lib/domain/dates";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"] as const;

export async function getDashboardStats() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  // IST midnight — the server runs on UTC, so "today" used to reset at 5:30 AM IST.
  const startOfToday = startOfIstDay();

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
    // Collection metadata count — O(1) instead of scanning every document on each dashboard load.
    Student.estimatedDocumentCount(),
    BookCopy.estimatedDocumentCount(),
    BookCopy.countDocuments({ status: "AVAILABLE" }),
    BookCopy.countDocuments({ status: "ISSUED" }),
    BorrowTransaction.countDocuments({ status: "ACTIVE", dueDate: { $lt: new Date() } }),
    BorrowTransaction.countDocuments({ issueDate: { $gte: startOfToday } }),
    BorrowTransaction.countDocuments({ returnDate: { $gte: startOfToday } }),
    BookCopy.countDocuments({ status: { $in: ["LOST", "DAMAGED"] } }),
    LibraryVisit.countDocuments({ status: "INSIDE", entryDate: { $gte: startOfToday } }),
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
  await requireRole([...STAFF_ROLES]); // was missing — names/IDs were readable by anyone
  await connectToDatabase();
  limit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 8)));
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

/** `limit` for on-screen/AI use; exports pass nothing to get every row. */
export async function getOverdueTransactions(limit?: number) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();
  const query = BorrowTransaction.find({ status: "ACTIVE", dueDate: { $lt: new Date() } })
    .sort({ dueDate: 1 })
    .populate("studentId", "name studentId phone");
  if (limit) query.limit(Math.min(5000, Math.max(1, Math.floor(limit))));
  return query.lean();
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

  days = Math.min(90, Math.max(1, Math.floor(Number(days) || 7)));
  const DAY_MS = 24 * 60 * 60 * 1000;
  const since = new Date(startOfIstDay().getTime() - (days - 1) * DAY_MS);

  const rows = await BorrowTransaction.aggregate([
    { $match: { issueDate: { $gte: since } } },
    {
      $group: {
        // Bucket by IST calendar day, not UTC.
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$issueDate", timezone: "+05:30" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDate = new Map(rows.map((r: any) => [r._id, r.count]));
  const result: { day: string; issues: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000); // midday IST of that day
    result.push({
      day: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: IST_TIMEZONE }),
      issues: byDate.get(istDayKey(d)) ?? 0,
    });
  }
  return result;
}
