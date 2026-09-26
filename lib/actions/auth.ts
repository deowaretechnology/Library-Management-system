"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession, clearSession } from "@/lib/auth/session";
import { rateLimit, isBlocked, recordFailure } from "@/lib/rate-limit";
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

// Compared against when the identifier doesn't exist, so a wrong ID takes as long as a
// wrong password — response time no longer reveals which Library IDs are real.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash() {
  dummyHashPromise ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHashPromise;
}

function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const FIVE_MIN = 5 * 60 * 1000;
const FIFTEEN_MIN = 15 * 60 * 1000;

/**
 * Brute-force protection, three layers:
 *  - per IP+identifier: every attempt counts (a real user never needs 5 tries in 5 min);
 *  - per IP and per identifier: only FAILED attempts count — so a campus sharing one NAT IP
 *    can all sign in, but one source spraying "password = Library ID" across thousands of
 *    IDs (or hammering one account from many IPs) gets cut off.
 */
function checkAuthLimits(prefix: string, ip: string, id: string) {
  const pair = rateLimit(`${prefix}:${ip}:${id}`, 5, FIVE_MIN);
  const byIp = isBlocked(`${prefix}-ip:${ip}`, 60);
  const byId = isBlocked(`${prefix}-id:${id}`, 15);
  const blocked = !pair.allowed || byIp.blocked || byId.blocked;
  return { blocked, retryAfterMs: Math.max(pair.retryAfterMs, byIp.retryAfterMs, byId.retryAfterMs) };
}
function recordAuthFailure(prefix: string, ip: string, id: string) {
  recordFailure(`${prefix}-ip:${ip}`, FIVE_MIN);
  recordFailure(`${prefix}-id:${id}`, FIFTEEN_MIN);
}

/** Password still equals the Library/Student ID it was created with (printed on the ID card). */
function isDefaultStudentPassword(password: string, student: LeanStudent | null) {
  if (!student) return false;
  const p = password.trim().toLowerCase();
  return p === student.libraryId.toLowerCase() || p === student.studentId.toLowerCase();
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const identifier = parsed.data.identifier.trim();
  const ip = clientIp(await headers());
  const idKey = identifier.toLowerCase();
  const { blocked, retryAfterMs } = checkAuthLimits("login", ip, idKey);
  if (blocked) {
    return { error: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).` };
  }

  try {
    await connectToDatabase();
  } catch {
    // connectToDatabase() gives up after ~4.5s instead of hanging — this turns that into a
    // clean message instead of an unhandled crash (master spec §39: never show raw DB errors).
    return { error: "Could not reach the library database. Check your connection and try again." };
  }

  const found = await findUserByIdentifier(identifier);
  const user = found.user;
  let student = found.student;

  // Password is ALWAYS checked before anything account-specific is revealed, and with the
  // same cost whether or not the account exists.
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    recordAuthFailure("login", ip, idKey);
    return { error: "Invalid credentials." };
  }

  // A student who signs in with their EMAIL instead of their Library ID still has a
  // Student profile — load it, or the default-password check below would be skipped.
  if (user.role === "STUDENT" && !student) {
    student = await Student.findOne({ userId: user._id }).lean<LeanStudent>();
  }
  if (user.status !== "ACTIVE") return { error: "This account is not active. Please contact the library." };

  // Default passwords are printed on every student's ID card — anyone could sign in as
  // anyone. Force a change before the first real session is ever issued.
  if (user.role === "STUDENT" && isDefaultStudentPassword(parsed.data.password, student)) {
    redirect(`/change-password?first=1&id=${encodeURIComponent(identifier)}`);
  }

  await createSession({
    userId: user._id.toString(),
    role: user.role,
    name: user.name,
    studentId: student?.studentId,
    sv: user.sessionVersion ?? 0,
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
  const ip = clientIp(await headers());
  const id = parsed.data.identifier.trim().toLowerCase();
  const { blocked, retryAfterMs } = checkAuthLimits("changepw", ip, id);
  if (blocked) {
    return { error: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).` };
  }

  try {
    await connectToDatabase();
  } catch {
    return { error: "Could not reach the library database. Check your connection and try again." };
  }

  const found = await findUserByIdentifier(parsed.data.identifier.trim());
  const user = found.user;
  let student = found.student;

  // Same generic message (and same bcrypt cost) whether the identifier doesn't exist or the
  // password is wrong — never reveal which, that's what lets someone enumerate Library IDs.
  const invalid = { error: "Current identifier or password is incorrect." };
  const valid = await verifyPassword(parsed.data.currentPassword, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    recordAuthFailure("changepw", ip, id);
    return invalid;
  }
  if (user.role === "STUDENT" && !student) {
    student = await Student.findOne({ userId: user._id }).lean<LeanStudent>();
  }
  if (user.status !== "ACTIVE") return { error: "This account is not active." };

  if (isDefaultStudentPassword(parsed.data.newPassword, student)) {
    return { error: "Choose a password that isn't your Library ID or Student ID." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  // Bumping sessionVersion signs out every existing session (e.g. an attacker who had the
  // old password) — requireSession() rejects tokens carrying an older version.
  await User.updateOne({ _id: user._id }, { $set: { passwordHash }, $inc: { sessionVersion: 1 } });

  await AuditLog.create({
    userId: user._id,
    role: user.role,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user._id.toString(),
  });

  redirect("/login?passwordChanged=1");
}
