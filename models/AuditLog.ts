import { Schema, model, models, Types } from "mongoose";

export interface IAuditLog {
  userId: Types.ObjectId; // ref -> User
  role: string;
  action: string; // e.g. "BOOK_ISSUED", "FINE_WAIVED"
  entityType: string; // e.g. "BorrowTransaction"
  entityId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  previousValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ timestamp: 1 });

// Audit entries are append-only — no update/delete helpers are exported on purpose.
export default models.AuditLog || model<IAuditLog>("AuditLog", AuditLogSchema);
