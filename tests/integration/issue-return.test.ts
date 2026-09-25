import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createSession } from "@/lib/auth/session";
import { issueBook, returnBook, renewBook } from "@/lib/actions/transactions";
import User from "@/models/User";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";
import BorrowTransaction from "@/models/BorrowTransaction";
import Fine from "@/models/Fine";
import LibrarySettings from "@/models/LibrarySettings";

async function seedLibrarian() {
  const user = await User.create({
    role: "LIBRARIAN",
    email: "librarian@test.local",
    passwordHash: "not-checked-in-this-test",
    name: "Test Librarian",
    status: "ACTIVE",
  });
  await createSession({ userId: user._id.toString(), role: "LIBRARIAN", name: user.name });
  return user;
}

async function seedStudent(overrides: Partial<{ studentId: string; libraryId: string }> = {}) {
  const user = await User.create({
    role: "STUDENT",
    email: `${overrides.studentId ?? "stu1"}@test.local`,
    passwordHash: "not-checked-in-this-test",
    name: "Test Student",
    status: "ACTIVE",
  });
  const student = await Student.create({
    userId: user._id,
    studentId: overrides.studentId ?? "STU-1",
    libraryId: overrides.libraryId ?? "LIB-1",
    enrollmentNo: "ENR1",
    name: "Test Student",
    email: user.email,
    phone: "9876543210",
    department: "CS",
    course: "B.Tech",
    semester: 3,
    academicYear: "2026-27",
  });
  return { user, student };
}

async function seedCopy(overrides: Partial<{ barcode: string; copyId: string }> = {}) {
  return BookCopy.create({
    copyId: overrides.copyId ?? "COPY-1",
    sanityBookId: "book-1",
    barcode: overrides.barcode ?? "BC-1",
    accessionNumber: `ACC-${overrides.barcode ?? "BC-1"}`,
    acquisitionDate: new Date(),
  });
}

describe("issueBook / returnBook integration", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await LibrarySettings.create({
      borrowingDurationDays: 7,
      maxBooksPerStudent: 3,
      finePerDay: 5,
      maxFineAmount: 500,
      maxRenewals: 2,
      allowRenewal: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("issues a copy, flips it to ISSUED, and creates an ACTIVE transaction", async () => {
    await seedLibrarian();
    const { student } = await seedStudent({ studentId: "STU-ISSUE", libraryId: "LIB-ISSUE" });
    await seedCopy({ barcode: "BC-ISSUE" });

    const result = await issueBook({ studentId: "STU-ISSUE", barcode: "BC-ISSUE" });
    expect(result.transactionId).toMatch(/^TXN-/);

    const copy = await BookCopy.findOne({ barcode: "BC-ISSUE" });
    expect(copy?.status).toBe("ISSUED");

    const txn = await BorrowTransaction.findOne({ transactionId: result.transactionId });
    expect(txn?.status).toBe("ACTIVE");
    expect(txn?.studentId.toString()).toBe(student._id.toString());
  });

  it("refuses to issue an already-issued copy", async () => {
    await seedLibrarian();
    await seedStudent({ studentId: "STU-DUP", libraryId: "LIB-DUP" });
    await seedCopy({ barcode: "BC-DUP" });

    await issueBook({ studentId: "STU-DUP", barcode: "BC-DUP" });
    await expect(issueBook({ studentId: "STU-DUP", barcode: "BC-DUP" })).rejects.toThrow(
      /already issued/i
    );
  });

  it("calculates a fine and frees the copy on a late return", async () => {
    await seedLibrarian();
    await seedStudent({ studentId: "STU-LATE", libraryId: "LIB-LATE" });
    await seedCopy({ barcode: "BC-LATE" });

    const { transactionId } = await issueBook({ studentId: "STU-LATE", barcode: "BC-LATE" });

    // Backdate the due date to simulate a 3-day-overdue return, same as a real librarian
    // would encounter — the point of this test is the fine math, not the passage of time.
    await BorrowTransaction.updateOne(
      { transactionId },
      { $set: { dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }
    );

    const result = await returnBook({ barcode: "BC-LATE" });
    expect(result.overdueDays).toBe(3);
    expect(result.fineAmount).toBe(15); // 3 days * ₹5/day from LibrarySettings

    const copy = await BookCopy.findOne({ barcode: "BC-LATE" });
    expect(copy?.status).toBe("AVAILABLE");

    const fine = await Fine.findOne({ transactionId: (await BorrowTransaction.findOne({ transactionId }))!._id });
    expect(fine?.amount).toBe(15);
    expect(fine?.status).toBe("PENDING");
  });

  it("returning on time creates no fine", async () => {
    await seedLibrarian();
    await seedStudent({ studentId: "STU-ONTIME", libraryId: "LIB-ONTIME" });
    await seedCopy({ barcode: "BC-ONTIME" });

    await issueBook({ studentId: "STU-ONTIME", barcode: "BC-ONTIME" });
    const result = await returnBook({ barcode: "BC-ONTIME" });

    expect(result.overdueDays).toBe(0);
    expect(result.fineAmount).toBe(0);
  });

  it("renewing pushes the due date forward and increments renewalCount", async () => {
    await seedLibrarian();
    await seedStudent({ studentId: "STU-RENEW", libraryId: "LIB-RENEW" });
    await seedCopy({ barcode: "BC-RENEW" });

    const { transactionId } = await issueBook({ studentId: "STU-RENEW", barcode: "BC-RENEW" });
    const before = (await BorrowTransaction.findOne({ transactionId }))!.dueDate;

    const result = await renewBook({ transactionId });

    expect(result.renewalCount).toBe(1);
    expect(result.dueDate.getTime()).toBe(before.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
});
