"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import { createBookCopySchema, markLostDamagedSchema } from "@/validators/transactions";
import BookCopy from "@/models/BookCopy";
import AuditLog from "@/models/AuditLog";
import BorrowTransaction from "@/models/BorrowTransaction";

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
