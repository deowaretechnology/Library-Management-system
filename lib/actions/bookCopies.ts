"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import { createBookCopySchema, markLostDamagedSchema } from "@/validators/transactions";
import { sanityReadClient } from "@/lib/sanity/client";
import { bookTitleByIdQuery } from "@/lib/sanity/queries";
import BookCopy from "@/models/BookCopy";
import AuditLog from "@/models/AuditLog";
import BorrowTransaction from "@/models/BorrowTransaction";
import Reservation from "@/models/Reservation";
import Student from "@/models/Student";

const STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN"] as const;

export async function createBookCopyAction(formData: FormData) {
  await requireRole([...STAFF_ROLES]);

  const parsed = createBookCopySchema.safeParse({
    sanityBookId: formData.get("sanityBookId"),
    copyId: formData.get("copyId"),
    barcode: formData.get("barcode"),
    accessionNumber: formData.get("accessionNumber"),
    rackId: formData.get("rackId") || undefined,
    shelfId: formData.get("shelfId") || undefined,
    condition: formData.get("condition") || undefined,
  });

  if (!parsed.success) {
    redirect(`/admin/book-copies?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await connectToDatabase();

  const dup = await BookCopy.findOne({
    $or: [
      { copyId: parsed.data.copyId },
      { barcode: parsed.data.barcode },
      { accessionNumber: parsed.data.accessionNumber },
    ],
  });
  if (dup) {
    redirect(`/admin/book-copies?error=${encodeURIComponent("Duplicate copy ID, barcode, or accession number.")}`);
  }

  await BookCopy.create({
    ...parsed.data,
    location: { rackId: parsed.data.rackId, shelfId: parsed.data.shelfId },
    acquisitionDate: new Date(),
  });

  revalidatePath("/admin/book-copies");
  // Carry the new copy's barcode back so the page can show its QR immediately —
  // no need to go hunting for the right row in the table.
  redirect(`/admin/book-copies?created=${encodeURIComponent(parsed.data.barcode)}`);
}

export async function listBookCopies(opts: { query?: string; status?: string; page?: number; pageSize?: number }) {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.query) {
    filter.$or = [
      { copyId: { $regex: opts.query, $options: "i" } },
      { barcode: { $regex: opts.query, $options: "i" } },
      { accessionNumber: { $regex: opts.query, $options: "i" } },
      { sanityBookId: { $regex: opts.query, $options: "i" } },
    ];
  }

  const [copies, total] = await Promise.all([
    BookCopy.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    BookCopy.countDocuments(filter),
  ]);

  // For any copy currently shown as ISSUED, look up who has it — so the admin doesn't
  // have to cross-check the Issue/Return log separately to answer "who has this book".
  const issuedCopyIds = (copies as any[]).filter((c) => c.status === "ISSUED").map((c) => c._id);
  const issuedTo = new Map<string, { studentDbId: string; studentName: string; libraryId: string; dueDate: Date }>();

  if (issuedCopyIds.length > 0) {
    const activeTxns = await BorrowTransaction.find({
      bookCopyId: { $in: issuedCopyIds },
      status: { $in: ["ACTIVE", "OVERDUE"] },
    })
      .populate("studentId", "name libraryId")
      .lean();

    for (const txn of activeTxns as any[]) {
      if (txn.studentId) {
        issuedTo.set(String(txn.bookCopyId), {
          studentDbId: String(txn.studentId._id),
          studentName: txn.studentId.name,
          libraryId: txn.studentId.libraryId,
          dueDate: txn.dueDate,
        });
      }
    }
  }

  const copiesWithIssuedTo = (copies as any[]).map((c) => ({
    ...c,
    issuedTo: issuedTo.get(String(c._id)) ?? null,
  }));

  return { copies: copiesWithIssuedTo, total, page, pageSize };
}

export async function getCopyByBarcode(barcode: string) {
  await connectToDatabase();
  return BookCopy.findOne({ barcode }).lean();
}

export type BookCopyLookup = {
  barcode: string;
  copyId: string;
  sanityBookId: string;
  status: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  canIssue: boolean;
  canReserve: boolean;
  alreadyReservedByStudent: boolean;
  awaitingApprovalByStudent: boolean;
  issuedTo?: { name: string; libraryId: string; dueDate: Date };
};

/**
 * Used by the Quick Issue counter flow: scan/type a book's barcode and show what it
 * actually is (title, cover, availability) BEFORE issuing — so a mis-scan or a typo'd
 * barcode surfaces as "wrong/unavailable book" instead of silently issuing whatever the
 * barcode happened to match. `canIssue`/`canReserve` are display hints only; issueBook and
 * reserveForStudentAction still do the real checks server-side at the moment of acting.
 *
 * `forStudentId` (the human studentId, e.g. "STU-2026-1001") is the student currently at
 * the counter — passing it lets a RESERVED copy correctly show as issuable when it's held
 * for THIS student, and lets an ISSUED copy offer "reserve it for them" instead.
 */
export async function getBookCopyLookupAction(barcode: string, forStudentId?: string): Promise<BookCopyLookup | null> {
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  await connectToDatabase();

  const copy: any = await BookCopy.findOne({ barcode: barcode.trim() }).lean();
  if (!copy) return null;

  const [book, student] = await Promise.all([
    sanityReadClient.fetch(bookTitleByIdQuery, { id: copy.sanityBookId }),
    forStudentId ? Student.findOne({ studentId: forStudentId }).lean() : Promise.resolve(null),
  ]);

  let issuedTo: BookCopyLookup["issuedTo"];
  let canIssue = copy.status === "AVAILABLE";
  let canReserve = false;
  let alreadyReservedByStudent = false;
  let awaitingApprovalByStudent = false;

  if (copy.status === "ISSUED") {
    const txn: any = await BorrowTransaction.findOne({ bookCopyId: copy._id, status: { $in: ["ACTIVE", "OVERDUE"] } })
      .populate("studentId", "name libraryId")
      .lean();
    if (txn?.studentId) {
      issuedTo = { name: txn.studentId.name, libraryId: txn.studentId.libraryId, dueDate: txn.dueDate };
    }
    if (student) {
      // Includes AWAITING_APPROVAL so staff can't create a second, duplicate PENDING
      // reservation via Quick Issue while the student's own self-requested one still
      // sits unapproved — canReserve stays false either way; the flags below just
      // decide which explanatory line the confirmation card shows.
      const existing: any = await Reservation.findOne({
        studentId: (student as any)._id,
        sanityBookId: copy.sanityBookId,
        status: { $in: ["AWAITING_APPROVAL", "PENDING", "READY"] },
      }).lean();
      if (existing?.status === "AWAITING_APPROVAL") awaitingApprovalByStudent = true;
      else if (existing) alreadyReservedByStudent = true;
      else canReserve = true;
    }
  }

  if (copy.status === "RESERVED" && student) {
    const readyForThisStudent = await Reservation.findOne({
      bookCopyId: copy._id,
      status: "READY",
      studentId: (student as any)._id,
    }).lean();
    if (readyForThisStudent) canIssue = true;
  }

  return {
    barcode: copy.barcode,
    copyId: copy.copyId,
    sanityBookId: copy.sanityBookId,
    status: copy.status,
    title: book?.title ?? "Unknown title",
    authors: book?.authors ?? [],
    coverUrl: book?.coverUrl ?? null,
    canIssue,
    canReserve,
    alreadyReservedByStudent,
    awaitingApprovalByStudent,
    issuedTo,
  };
}

export async function markLostOrDamagedAction(formData: FormData) {
  const session = await requireRole([...STAFF_ROLES]);
  const parsed = markLostDamagedSchema.safeParse({
    barcode: formData.get("barcode"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/lost-damaged?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { barcode, status, notes } = parsed.data;

  await connectToDatabase();
  const copy = await BookCopy.findOne({ barcode });
  if (!copy) redirect(`/admin/lost-damaged?error=${encodeURIComponent("Invalid or unrecognized barcode.")}`);
  if (copy!.status === "ISSUED") {
    redirect(`/admin/lost-damaged?error=${encodeURIComponent("Return the book before marking it lost or damaged.")}`);
  }

  const previousStatus = copy!.status;
  copy!.status = status;
  copy!.notes = notes ?? "";
  await copy!.save();

  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: `COPY_${status}`,
    entityType: "BookCopy",
    entityId: copy!.copyId,
    previousValue: { status: previousStatus },
    newValue: { status, notes },

  });

  revalidatePath("/admin/lost-damaged");
  redirect("/admin/lost-damaged");
}
