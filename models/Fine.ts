import { Schema, model, models, Types } from "mongoose";

export type FineStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "WAIVED" | "CANCELLED";

export interface IFine {
  fineId: string;
  studentId: Types.ObjectId; // ref -> Student
  transactionId: Types.ObjectId; // ref -> BorrowTransaction
  amount: number;
  reason: string;
  overdueDays: number;
  status: FineStatus;
  paidAt?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  paymentLinkId?: string;
  paymentLinkUrl?: string;
  /** Razorpay reference_id of the current link (fineId + "_" + attempt suffix — Razorpay rejects a reused reference_id). */
  paymentLinkRef?: string;
  /** Outstanding amount the current link was created for — reused only while it still matches. */
  paymentLinkAmount?: number;
  /** Running total actually collected (counter + online). `amount` is the OUTSTANDING balance, so without this partial payments vanished from collection reports. */
  amountPaid: number;
  waivedBy?: Types.ObjectId; // ref -> User
  notes?: string;
  createdAt: Date;
}

const FineSchema = new Schema<IFine>(
  {
    fineId: { type: String, required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "BorrowTransaction", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    overdueDays: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PARTIALLY_PAID", "PAID", "WAIVED", "CANCELLED"],
      default: "PENDING",
    },
    paidAt: { type: Date },
    paymentMethod: { type: String },
    paymentReference: { type: String },
    paymentLinkId: { type: String },
    paymentLinkUrl: { type: String },
    paymentLinkRef: { type: String },
    paymentLinkAmount: { type: Number },
    amountPaid: { type: Number, default: 0 },
    waivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FineSchema.index({ studentId: 1, status: 1 });
FineSchema.index({ status: 1, createdAt: -1 });
FineSchema.index({ createdAt: -1 });
FineSchema.index({ studentId: 1, createdAt: -1 });
FineSchema.index({ paymentLinkRef: 1 }, { sparse: true });

export default models.Fine || model<IFine>("Fine", FineSchema);
