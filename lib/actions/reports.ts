"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";

export async function getMostBorrowedBooks(limit = 10) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  return BorrowTransaction.aggregate([
    { $group: { _id: "$sanityBookId", borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } },
    { $limit: limit },
  ]);
}

export async function getDepartmentWiseBorrowing() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  return BorrowTransaction.aggregate([
    // Collapse to one row per student FIRST, so the $lookup runs once per student instead
    // of once per transaction (was a join on the entire loan history).
    { $group: { _id: "$studentId", count: { $sum: 1 } } },
    {
      $lookup: {
        from: Student.collection.collectionName,
        localField: "_id",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $group: { _id: "$student.department", count: { $sum: "$count" } } },
    { $sort: { count: -1 } },
  ]);
}

export async function getFineCollectionSummary() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  // `collected` = money actually received (partial + full). `total` is the outstanding /
  // final balance per status, which on its own hid every partial payment.
  const rows = await Fine.aggregate([
    { $group: { _id: "$status", total: { $sum: "$amount" }, collected: {
          $sum: {
            // Fines paid before amountPaid existed have no such field: count a PAID one's
            // final amount as collected so history isn't reported as ₹0.
            $ifNull: ["$amountPaid", { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] }],
          },
        }, count: { $sum: 1 } } },
  ]);
  return rows;
}

/** Every student with their current borrow count and outstanding fine total. `limit` for on-page previews; exports pass nothing. */
export async function getStudentReport(limit?: number) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();

  return Student.aggregate([
    { $sort: { name: 1 } },
    ...(limit ? [{ $limit: limit }] : []),
    {
      // localField/foreignField (+ a filter pipeline) lets MongoDB use the {studentId, status}
      // index for each join; the old $expr-only form scanned the collection per student.
      $lookup: {
        from: BorrowTransaction.collection.collectionName,
        localField: "_id",
        foreignField: "studentId",
        pipeline: [{ $match: { status: "ACTIVE" } }, { $project: { _id: 1 } }],
        as: "activeBorrows",
      },
    },
    {
      $lookup: {
        from: Fine.collection.collectionName,
        localField: "_id",
        foreignField: "studentId",
        pipeline: [{ $match: { status: { $in: ["PENDING", "PARTIALLY_PAID"] } } }, { $project: { amount: 1 } }],
        as: "pendingFines",
      },
    },
    {
      $project: {
        name: 1,
        studentId: 1,
        department: 1,
        status: 1,
        clearanceConfirmedAt: 1,
        activeBorrowCount: { $size: "$activeBorrows" },
        pendingFineCount: { $size: "$pendingFines" },
        pendingFineTotal: { $sum: "$pendingFines.amount" },
      },
    },
  ]);
}

/** Inventory breakdown by copy status. */
export async function getInventoryReport() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  return BookCopy.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
}

/**
 * Clearance status across all students — who's cleared vs. pending. Was 2 queries PER
 * student (10,000 round trips for 5,000 students, through a 10-connection pool); now it
 * reuses the single $lookup aggregation behind the student report.
 */
export async function getClearanceReport(limit?: number) {
  const rows = await getStudentReport(limit);
  return (rows as any[]).map((s) => ({
    name: s.name,
    studentId: s.studentId,
    department: s.department,
    eligible: s.activeBorrowCount === 0 && s.pendingFineCount === 0,
    confirmed: !!s.clearanceConfirmedAt,
  }));
}

/** Issues and returns per month for the current calendar year. */
export async function getMonthlyStats(year = new Date().getFullYear()) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [issues, returns] = await Promise.all([
    BorrowTransaction.aggregate([
      { $match: { issueDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: "$issueDate" }, count: { $sum: 1 } } },
    ]),
    BorrowTransaction.aggregate([
      { $match: { returnDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: "$returnDate" }, count: { $sum: 1 } } },
    ]),
  ]);

  const issuesByMonth = new Map(issues.map((r: any) => [r._id, r.count]));
  const returnsByMonth = new Map(returns.map((r: any) => [r._id, r.count]));

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return monthNames.map((name, i) => ({
    month: name,
    issues: issuesByMonth.get(i + 1) ?? 0,
    returns: returnsByMonth.get(i + 1) ?? 0,
  }));
}

/** Books issued within a date range (defaults to the last 30 days). */
export async function getIssueReport(days = 30, limit?: number) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const q = BorrowTransaction.find({ issueDate: { $gte: since } })
    .sort({ issueDate: -1 })
    .populate("studentId", "name studentId");
  if (limit) q.limit(limit);
  return q.lean();
}

/** Books returned within a date range (defaults to the last 30 days). */
export async function getReturnReport(days = 30, limit?: number) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const q = BorrowTransaction.find({ status: "RETURNED", returnDate: { $gte: since } })
    .sort({ returnDate: -1 })
    .populate("studentId", "name studentId");
  if (limit) q.limit(limit);
  return q.lean();
}

/** Every copy currently marked LOST, DAMAGED, or REPAIR, with notes. */
export async function getLostDamagedReport() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  return BookCopy.find({ status: { $in: ["LOST", "DAMAGED", "REPAIR"] } })
    .sort({ updatedAt: -1 })
    .lean();
}

/** Library visits within a date range (defaults to the last 30 days). */
export async function getEntryExitReport(days = 30, limit?: number) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const LibraryVisit = (await import("@/models/LibraryVisit")).default;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const q = LibraryVisit.find({ entryDate: { $gte: since } })
    .sort({ entryDate: -1 })
    .populate("studentId", "name studentId");
  if (limit) q.limit(limit);
  return q.lean();
}

/** Students ranked by combined activity: borrows + library visits. */
export async function getMostActiveStudents(limit = 10) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const LibraryVisit = (await import("@/models/LibraryVisit")).default;

  // One pipeline, ranked and limited inside MongoDB — previously both full group-bys were
  // shipped to Node (one row per student) just to be sorted in JavaScript.
  const rankedRows = await BorrowTransaction.aggregate([
    { $project: { s: "$studentId", b: { $literal: 1 }, v: { $literal: 0 } } },
    {
      $unionWith: {
        coll: LibraryVisit.collection.collectionName,
        pipeline: [{ $project: { s: "$studentId", b: { $literal: 0 }, v: { $literal: 1 } } }],
      },
    },
    { $group: { _id: "$s", borrows: { $sum: "$b" }, visits: { $sum: "$v" } } },
    { $addFields: { total: { $add: ["$borrows", "$visits"] } } },
    { $sort: { total: -1 } },
    { $limit: Math.min(200, Math.max(1, limit)) },
  ]);
  const ranked = rankedRows.map((r: any) => ({ studentId: r._id.toString(), borrows: r.borrows, visits: r.visits, total: r.total }));

  const students = await Student.find({ _id: { $in: ranked.map((r) => r.studentId) } })
    .select("name studentId department")
    .lean();
  const byId = new Map(students.map((s: any) => [s._id.toString(), s]));

  return ranked.map((r) => ({ ...r, student: byId.get(r.studentId) }));
}

/** Issues and returns per month for a given year — the "Annual Statistics" report. */
export async function getAnnualStats(year = new Date().getFullYear()) {
  const monthly = await getMonthlyStats(year);
  const totalIssues = monthly.reduce((sum, m) => sum + m.issues, 0);
  const totalReturns = monthly.reduce((sum, m) => sum + m.returns, 0);
  return { year, monthly, totalIssues, totalReturns };
}
