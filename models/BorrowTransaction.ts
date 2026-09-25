import { Schema, model, models, Types } from "mongoose";

export type TransactionStatus = "ACTIVE" | "RETURNED" | "OVERDUE";

export interface IBorrowTransaction {
  transactionId: string;
  studentId: Types.ObjectId; // ref -> Student
  sanityBookId: string;
  bookCopyId: Types.ObjectId; // ref -> BookCopy
  issueDate: Date;
  dueDate: Date;
  returnDate?: Date;
  renewalCount: number;
  issuedBy: Types.ObjectId; // ref -> User
  returnedTo?: Types.ObjectId; // ref -> User
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BorrowTransactionSchema = new Schema<IBorrowTransaction>(
  {
    transactionId: { type: String, required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    sanityBookId: { type: String, required: true },
    bookCopyId: { type: Schema.Types.ObjectId, ref: "BookCopy", required: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    renewalCount: { type: Number, default: 0 },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    returnedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["ACTIVE", "RETURNED", "OVERDUE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

BorrowTransactionSchema.index({ studentId: 1, status: 1 });
BorrowTransactionSchema.index({ bookCopyId: 1, status: 1 });
BorrowTransactionSchema.index({ dueDate: 1 });

export default models.BorrowTransaction ||
  model<IBorrowTransaction>("BorrowTransaction", BorrowTransactionSchema);
