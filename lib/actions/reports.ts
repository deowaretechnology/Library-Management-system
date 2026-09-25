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
    {
      $lookup: {
        from: Student.collection.collectionName,
        localField: "studentId",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $group: { _id: "$student.department", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
}

export async function getFineCollectionSummary() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const rows = await Fine.aggregate([{ $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } }]);
  return rows;
}

/** Every student with their current borrow count and outstanding fine total. */
export async function getStudentReport() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();

  return Student.aggregate([
    {
      $lookup: {
        from: "borrowtransactions",
        let: { sid: "$_id" },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$studentId", "$$sid"] }, { $eq: ["$status", "ACTIVE"] }] } } }],
        as: "activeBorrows",
      },
    },
    {
      $lookup: {
        from: "fines",
        let: { sid: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$studentId", "$$sid"] }, { $in: ["$status", ["PENDING", "PARTIALLY_PAID"]] }] } } },
        ],
        as: "pendingFines",
      },
    },
    {
      $project: {
        name: 1,
        studentId: 1,
        department: 1,
        status: 1,
        activeBorrowCount: { $size: "$activeBorrows" },
        pendingFineTotal: { $sum: "$pendingFines.amount" },
      },
    },
    { $sort: { name: 1 } },
  ]);
}

/** Inventory breakdown by copy status. */
export async function getInventoryReport() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  return BookCopy.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
}

/** Clearance status across all students — who's cleared vs. pending. */
export async function getClearanceReport() {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const students = await Student.find({}).select("name studentId department clearanceConfirmedAt").lean();

  return Promise.all(
    students.map(async (s: any) => {
      const [activeCount, pendingFines] = await Promise.all([
        BorrowTransaction.countDocuments({ studentId: s._id, status: "ACTIVE" }),
        Fine.countDocuments({ studentId: s._id, status: { $in: ["PENDING", "PARTIALLY_PAID"] } }),
      ]);
      return {
        name: s.name,
        studentId: s.studentId,
        department: s.department,
        eligible: activeCount === 0 && pendingFines === 0,
        confirmed: !!s.clearanceConfirmedAt,
      };
    })
  );
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
export async function getIssueReport(days = 30) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return BorrowTransaction.find({ issueDate: { $gte: since } })
    .sort({ issueDate: -1 })
    .populate("studentId", "name studentId")
    .lean();
}

/** Books returned within a date range (defaults to the last 30 days). */
export async function getReturnReport(days = 30) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return BorrowTransaction.find({ status: "RETURNED", returnDate: { $gte: since } })
    .sort({ returnDate: -1 })
    .populate("studentId", "name studentId")
    .lean();
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
export async function getEntryExitReport(days = 30) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const LibraryVisit = (await import("@/models/LibraryVisit")).default;
  const since = new Date();
  since.setDate(since.getDate() - days);

  return LibraryVisit.find({ entryDate: { $gte: since } })
    .sort({ entryDate: -1 })
    .populate("studentId", "name studentId")
    .lean();
}

/** Students ranked by combined activity: borrows + library visits. */
export async function getMostActiveStudents(limit = 10) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN"]);
  await connectToDatabase();
  const LibraryVisit = (await import("@/models/LibraryVisit")).default;

  const [borrowCounts, visitCounts] = await Promise.all([
    BorrowTransaction.aggregate([{ $group: { _id: "$studentId", borrows: { $sum: 1 } } }]),
    LibraryVisit.aggregate([{ $group: { _id: "$studentId", visits: { $sum: 1 } } }]),
  ]);

  const activity = new Map<string, { borrows: number; visits: number }>();
  for (const row of borrowCounts) activity.set(row._id.toString(), { borrows: row.borrows, visits: 0 });
  for (const row of visitCounts) {
    const key = row._id.toString();
    const existing = activity.get(key) ?? { borrows: 0, visits: 0 };
    activity.set(key, { ...existing, visits: row.visits });
  }

  const ranked = [...activity.entries()]
    .map(([studentId, counts]) => ({ studentId, ...counts, total: counts.borrows + counts.visits }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

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
