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
  },
  { timestamps: true }
);

export default models.User || model<IUser>("User", UserSchema);
