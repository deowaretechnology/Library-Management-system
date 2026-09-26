import { Schema, model, models, Types } from "mongoose";

export type NotificationType =
  | "DUE_SOON"
  | "DUE_TODAY"
  | "OVERDUE"
  | "FINE_ISSUED"
  | "RESERVATION_READY"
  | "RESERVATION_APPROVED"
  | "RESERVATION_REJECTED"
  | "RESERVATION_EXPIRED"
  | "ANNOUNCEMENT";

export interface INotification {
  studentId: Types.ObjectId; // ref -> Student
  type: NotificationType;
  message: string;
  read: boolean;
  /** What this notice is about (e.g. a transactionId) — lets the daily sweep de-duplicate with an indexed lookup instead of a regex over message text. */
  refId?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    type: {
      type: String,
      enum: [
        "DUE_SOON",
        "DUE_TODAY",
        "OVERDUE",
        "FINE_ISSUED",
        "RESERVATION_READY",
        "RESERVATION_APPROVED",
        "RESERVATION_REJECTED",
        "RESERVATION_EXPIRED",
        "ANNOUNCEMENT",
      ],
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    refId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ studentId: 1, read: 1 });
NotificationSchema.index({ studentId: 1, createdAt: -1 });
NotificationSchema.index({ refId: 1, createdAt: -1 }, { sparse: true });

export default models.Notification || model<INotification>("Notification", NotificationSchema);
