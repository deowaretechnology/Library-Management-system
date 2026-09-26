import { Schema, model, models, Types } from "mongoose";

export type UserRole = "SUPER_ADMIN" | "LIBRARIAN" | "LIBRARY_STAFF" | "STUDENT";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface IUser {
  role: UserRole;
  email: string;
  passwordHash: string;
  name: string;
  status: UserStatus;
  studentProfile?: Types.ObjectId; // ref -> Student, present only when role === STUDENT
  /** Bumped on password change — any session token carrying an older value is rejected (lib/auth/requireRole.ts). */
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF", "STUDENT"],
      required: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE" },
    studentProfile: { type: Schema.Types.ObjectId, ref: "Student" },
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default models.User || model<IUser>("User", UserSchema);
