import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "SUPER_ADMIN" | "LIBRARIAN" | "LIBRARY_STAFF" | "STUDENT";

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
  studentId?: string; // present only for STUDENT accounts — used for ownership checks
};

const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
const cookieName = process.env.SESSION_COOKIE_NAME || "lms_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);

  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null; // expired / tampered / missing secret match
  }
}

export async function clearSession() {
  (await cookies()).delete(cookieName);
}
