import { describe, it, expect } from "vitest";
import BookCopy from "@/models/BookCopy";
import Fine from "@/models/Fine";
import Student from "@/models/Student";
import BorrowTransaction from "@/models/BorrowTransaction";
import mongoose from "mongoose";

describe("BookCopy schema", () => {
  it("rejects a missing required field", () => {
    const copy = new BookCopy({ barcode: "BC1" }); // missing copyId, sanityBookId, accessionNumber, acquisitionDate
    const err = copy.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors.copyId).toBeDefined();
    expect(err?.errors.sanityBookId).toBeDefined();
  });

  it("rejects a status outside the enum", () => {
    const copy = new BookCopy({
      copyId: "C1",
      sanityBookId: "book-1",
      barcode: "BC1",
      accessionNumber: "ACC1",
      acquisitionDate: new Date(),
      status: "MISPLACED", // not a valid enum value
    });
    const err = copy.validateSync();
    expect(err?.errors.status).toBeDefined();
  });

  it("defaults status to AVAILABLE and passes with all required fields", () => {
    const copy = new BookCopy({
      copyId: "C1",
      sanityBookId: "book-1",
      barcode: "BC1",
      accessionNumber: "ACC1",
      acquisitionDate: new Date(),
    });
    expect(copy.validateSync()).toBeUndefined();
    expect(copy.status).toBe("AVAILABLE");
  });
});

describe("Fine schema", () => {
  it("requires studentId, transactionId, amount and reason", () => {
    const fine = new Fine({});
    const err = fine.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors.studentId).toBeDefined();
    expect(err?.errors.transactionId).toBeDefined();
    expect(err?.errors.amount).toBeDefined();
    expect(err?.errors.reason).toBeDefined();
  });

  it("defaults status to PENDING", () => {
    const fine = new Fine({
      fineId: "F1",
      studentId: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId(),
      amount: 50,
      reason: "Overdue",
    });
    expect(fine.validateSync()).toBeUndefined();
    expect(fine.status).toBe("PENDING");
  });
});

describe("Student schema", () => {
  it("requires the core identity fields", () => {
    const student = new Student({ name: "Test" });
    const err = student.validateSync();
    expect(err?.errors.userId).toBeDefined();
    expect(err?.errors.studentId).toBeDefined();
    expect(err?.errors.libraryId).toBeDefined();
  });

  it("defaults status to ACTIVE and passes with all required fields", () => {
    const student = new Student({
      userId: new mongoose.Types.ObjectId(),
      studentId: "STU-1",
      libraryId: "LIB-1",
      enrollmentNo: "ENR1",
      name: "Test Student",
      email: "test@example.com",
      phone: "9876543210",
      department: "CS",
      course: "B.Tech",
      semester: 3,
      academicYear: "2026-27",
    });
    expect(student.validateSync()).toBeUndefined();
    expect(student.status).toBe("ACTIVE");
  });
});

describe("BorrowTransaction schema", () => {
  it("defaults renewalCount to 0 and status to ACTIVE", () => {
    const txn = new BorrowTransaction({
      transactionId: "TXN-1",
      studentId: new mongoose.Types.ObjectId(),
      sanityBookId: "book-1",
      bookCopyId: new mongoose.Types.ObjectId(),
      issueDate: new Date(),
      dueDate: new Date(),
      issuedBy: new mongoose.Types.ObjectId(),
    });
    expect(txn.validateSync()).toBeUndefined();
    expect(txn.renewalCount).toBe(0);
    expect(txn.status).toBe("ACTIVE");
  });

  it("rejects a status outside the enum", () => {
    const txn = new BorrowTransaction({
      transactionId: "TXN-1",
      studentId: new mongoose.Types.ObjectId(),
      sanityBookId: "book-1",
      bookCopyId: new mongoose.Types.ObjectId(),
      issueDate: new Date(),
      dueDate: new Date(),
      issuedBy: new mongoose.Types.ObjectId(),
      status: "LOST", // not a valid transaction status
    });
    const err = txn.validateSync();
    expect(err?.errors.status).toBeDefined();
  });
});
