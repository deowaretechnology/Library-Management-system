import { Schema, model, models, Types } from "mongoose";

export type NotificationType =
  | "DUE_SOON"
  | "DUE_TODAY"
  | "OVERDUE"
  | "FINE_ISSUED"
  | "RESERVATION_READY"
  | "RESERVATION_APPROVED"
  | "RESERVATION_REJECTED"
  | "ANNOUNCEMENT";

export interface INotification {
  studentId: Types.ObjectId; // ref -> Student
  type: NotificationType;
  message: string;
  read: boolean;
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
        "ANNOUNCEMENT",
      ],
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ studentId: 1, read: 1 });

export default models.Notification || model<INotification>("Notification", NotificationSchema);
