import { Schema, model, models, Types } from "mongoose";

export type VisitStatus = "INSIDE" | "EXITED";

export interface ILibraryVisit {
  visitId: string;
  studentId: Types.ObjectId; // ref -> Student
  entryDate: Date;
  entryTime: string; // "HH:mm"
  exitDate?: Date;
  exitTime?: string;
  durationMinutes?: number;
  entryMethod: string; // e.g. "barcode-scan"
  exitMethod?: string;
  status: VisitStatus;
  createdAt: Date;
}

const LibraryVisitSchema = new Schema<ILibraryVisit>(
  {
    visitId: { type: String, required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    entryDate: { type: Date, required: true },
    entryTime: { type: String, required: true },
    exitDate: { type: Date },
    exitTime: { type: String },
    durationMinutes: { type: Number },
    entryMethod: { type: String, required: true },
    exitMethod: { type: String },
    status: { type: String, enum: ["INSIDE", "EXITED"], default: "INSIDE" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LibraryVisitSchema.index({ studentId: 1, status: 1 });
LibraryVisitSchema.index({ entryDate: 1 });
// A student can be INSIDE at most once — a double gate-scan can no longer create two open visits.
LibraryVisitSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { status: "INSIDE" }, name: "one_open_visit_per_student" }
);
LibraryVisitSchema.index({ status: 1, entryDate: -1 });
LibraryVisitSchema.index({ createdAt: -1 });
LibraryVisitSchema.index({ studentId: 1, entryDate: -1 });

export default models.LibraryVisit || model<ILibraryVisit>("LibraryVisit", LibraryVisitSchema);
