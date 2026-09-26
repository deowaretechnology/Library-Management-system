import { z } from "zod";

export const issueBookSchema = z.object({
  studentId: z.string().trim().min(1, "Scan or enter a student ID").max(64),
  barcode: z.string().trim().min(1, "Scan or enter a copy barcode").max(64),
});
export type IssueBookInput = z.infer<typeof issueBookSchema>;

export const returnBookSchema = z.object({
  barcode: z.string().trim().min(1, "Scan or enter a copy barcode").max(64),
});
export type ReturnBookInput = z.infer<typeof returnBookSchema>;

export const renewBookSchema = z.object({
  transactionId: z.string().trim().min(1).max(64),
});
export type RenewBookInput = z.infer<typeof renewBookSchema>;

export const createStudentSchema = z.object({
  name: z.string().min(1),
  studentId: z.string().min(1),
  libraryId: z.string().min(1),
  enrollmentNo: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  department: z.string().min(1),
  course: z.string().min(1),
  semester: z.number().int().min(1).max(12),
  academicYear: z.string().min(1),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const createBookCopySchema = z.object({
  sanityBookId: z.string().min(1, "Sanity Book ID is required"),
  copyId: z.string().min(1, "Copy ID is required"),
  barcode: z.string().min(1, "Barcode is required"),
  accessionNumber: z.string().min(1, "Accession number is required"),
  rackId: z.string().optional(),
  shelfId: z.string().optional(),
  condition: z.string().optional(),
});
export type CreateBookCopyInput = z.infer<typeof createBookCopySchema>;

export const librarySettingsSchema = z.object({
  libraryName: z.string().min(1, "Library name is required").max(120),
  libraryEmail: z.string().email("Enter a valid email").max(200).or(z.literal("")).optional(),
  libraryPhone: z.string().max(30).optional(),
  libraryAddress: z.string().max(300).optional(),
  borrowingDurationDays: z.number().int().min(1, "Must be at least 1 day").max(365, "At most 365 days"),
  maxBooksPerStudent: z.number().int().min(1, "Must be at least 1").max(50, "At most 50"),
  finePerDay: z.number().min(0, "Cannot be negative").max(10000),
  gracePeriodDays: z.number().int().min(0, "Cannot be negative").max(60),
  maxRenewals: z.number().int().min(0, "Cannot be negative").max(20),
  maxFineAmount: z.number().min(0, "Cannot be negative").max(100000),
  allowRenewal: z.boolean(),
});
export type LibrarySettingsInput = z.infer<typeof librarySettingsSchema>;

export const markLostDamagedSchema = z.object({
  barcode: z.string().min(1, "Barcode is required"),
  // AVAILABLE = "found / repaired — put it back in circulation" (there was no way back before).
  status: z.enum(["LOST", "DAMAGED", "REPAIR", "AVAILABLE"], { errorMap: () => ({ message: "Choose a status" }) }),
  notes: z.string().max(500).optional(),
});
export type MarkLostDamagedInput = z.infer<typeof markLostDamagedSchema>;

export const payFineSchema = z.object({
  fineId: z.string().min(1).max(64),
  amount: z.number().positive("Enter an amount greater than 0").max(1_000_000),
  paymentMethod: z.string().max(40).optional(),
  paymentReference: z.string().max(120).optional(),
});
export type PayFineInput = z.infer<typeof payFineSchema>;
