"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession, clearSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/validators/account";
import User, { IUser } from "@/models/User";
import Student, { IStudent } from "@/models/Student";
import AuditLog from "@/models/AuditLog";

type LeanStudent = IStudent & { _id: Types.ObjectId };
type LeanUser = IUser & { _id: Types.ObjectId };

const loginSchema = z.object({
  identifier: z.string().min(1, "Enter your email or student ID"),
  password: z.string().min(1, "Enter your password"),
});

/** Students log in with their Library/Student ID (never contains "@"); staff/admin use email. */
async function findUserByIdentifier(identifier: string) {
  const looksLikeEmail = identifier.includes("@");
  // .lean() skips building a full Mongoose document (change-tracking, getters, etc.) for
  // rows we only ever read — a small but free win on every call.
  const student = looksLikeEmail
    ? null
    : await Student.findOne({
        $or: [{ studentId: identifier }, { libraryId: identifier }],
      }).lean<LeanStudent>();

  const user = student
    ? await User.findById(student.userId).lean<LeanUser>()
    : await User.findOne({ email: identifier.toLowerCase() }).lean<LeanUser>();

  return { student, user };
}

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfterMs } = rateLimit(`login:${ip}:${parsed.data.identifier.toLowerCase()}`, 5, 5 * 60 * 1000);
  if (!allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).` };
  }

  try {
    await connectToDatabase();
  } catch {
    // connectToDatabase() now gives up after ~4.5s instead of hanging — this turns that
    // into a clean message instead of an unhandled crash (master spec §39: never show
    // raw database errors).
    return { error: "Could not reach the library database. Check your connection and try again." };
  }

  const { student, user } = await findUserByIdentifier(parsed.data.identifier);

  if (!user) return { error: "Invalid credentials." };
  if (user.status !== "ACTIVE") return { error: "This account is not active." };

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return { error: "Invalid credentials." };

  await createSession({
    userId: user._id.toString(),
    role: user.role,
    name: user.name,
    studentId: student?.studentId,
  });

  redirect(user.role === "STUDENT" ? "/student/dashboard" : "/admin/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export type ChangePasswordState = { error?: string };

/**
 * Public, self-service "change your own password" — reachable from the login page
 * without being signed in yet. Gated entirely by knowing the CURRENT password (this is
 * not an email-based reset flow); this is what stops a student's password from staying
 * permanently equal to their Library ID, which anyone can read off their ID card.
 */
export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    identifier: formData.get("identifier"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // This endpoint is itself a credential-guessing surface (attacker supplies guesses for
  // "current password"), so it gets the same rate limit as login itself.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfterMs } = rateLimit(
    `changepw:${ip}:${parsed.data.identifier.toLowerCase()}`,
    5,
    5 * 60 * 1000
  );
  if (!allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).` };
  }

  try {
    await connectToDatabase();
  } catch {
    return { error: "Could not reach the library database. Check your connection and try again." };
  }

  const { user } = await findUserByIdentifier(parsed.data.identifier);

  // Same generic message whether the identifier doesn't exist or the password is wrong —
  // never reveal which one, that's exactly what lets someone enumerate valid Library IDs.
  const invalid = { error: "Current identifier or password is incorrect." };
  if (!user) return invalid;
  if (user.status !== "ACTIVE") return { error: "This account is not active." };

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return invalid;

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash } });

  await AuditLog.create({
    userId: user._id,
    role: user.role,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user._id.toString(),
  });

  redirect("/login?passwordChanged=1");
}
