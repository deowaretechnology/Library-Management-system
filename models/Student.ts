import { Schema, model, models, Types } from "mongoose";

export type StudentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "GRADUATED" | "BLOCKED";

export interface IStudent {
  userId: Types.ObjectId; // ref -> User
  studentId: string;
  libraryId: string;
  enrollmentNo: string;
  name: string;
  photoUrl?: string;
  email: string;
  phone: string;
  department: string;
  course: string;
  semester: number;
  section?: string;
  academicYear: string;
  status: StudentStatus;
  clearanceConfirmedAt?: Date;
  clearanceConfirmedBy?: Types.ObjectId; // ref -> User
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    libraryId: { type: String, required: true, unique: true, trim: true },
    enrollmentNo: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    photoUrl: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    department: { type: String, required: true },
    course: { type: String, required: true },
    semester: { type: Number, required: true },
    section: { type: String },
    academicYear: { type: String, required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED", "BLOCKED"],
      default: "ACTIVE",
    },
    clearanceConfirmedAt: { type: Date },
    clearanceConfirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default models.Student || model<IStudent>("Student", StudentSchema);
