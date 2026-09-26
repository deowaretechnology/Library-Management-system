import { Schema, model, models, Types } from "mongoose";

// AWAITING_APPROVAL — a student self-requested this; it doesn't hold a place in the
// queue and can't be turned into a held copy until staff approves it (approving moves
// it to PENDING, same as any staff-created reservation from here on).
export type ReservationStatus = "AWAITING_APPROVAL" | "PENDING" | "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED";

export interface IReservation {
  reservationId: string;
  studentId: Types.ObjectId; // ref -> Student
  sanityBookId: string;
  bookCopyId?: Types.ObjectId; // ref -> BookCopy, set once a copy is held for this reservation
  status: ReservationStatus;
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId; // ref -> User
  readyAt?: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;
  notes?: string;
}

const ReservationSchema = new Schema<IReservation>({
  reservationId: { type: String, required: true, unique: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  sanityBookId: { type: String, required: true },
  bookCopyId: { type: Schema.Types.ObjectId, ref: "BookCopy" },
  status: {
    type: String,
    enum: ["AWAITING_APPROVAL", "PENDING", "READY", "FULFILLED", "CANCELLED", "EXPIRED"],
    default: "PENDING",
  },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  readyAt: { type: Date },
  fulfilledAt: { type: Date },
  cancelledAt: { type: Date },
  notes: { type: String },
});

ReservationSchema.index({ sanityBookId: 1, status: 1 });
ReservationSchema.index({ studentId: 1, status: 1 });

export default models.Reservation || model<IReservation>("Reservation", ReservationSchema);
