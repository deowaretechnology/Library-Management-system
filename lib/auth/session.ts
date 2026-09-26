import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "SUPER_ADMIN" | "LIBRARIAN" | "LIBRARY_STAFF" | "STUDENT";

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
  studentId?: string; // present only for STUDENT accounts — used for ownership checks
  /** User.sessionVersion at login. Bumping it (password change) invalidates every older session. Absent on pre-existing tokens = 0. */
  sv?: number;
};

const cookieName = process.env.SESSION_COOKIE_NAME || "lms_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let cachedKey: Uint8Array | null = null;

/**
 * Resolved lazily (not at module load) so a missing secret fails loudly at the first
 * login instead of silently. Previously `new TextEncoder().encode(undefined)` produced an
 * EMPTY key, and jose happily signs/verifies HS256 with an empty key — so a deployment that
 * forgot SESSION_SECRET would let anyone forge a SUPER_ADMIN token.
 */
function getKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("SESSION_SECRET is not set — refusing to sign or verify sessions with an empty key.");
  }
  if (secret.length < 32) {
    console.warn("[security] SESSION_SECRET is shorter than 32 characters — use a long random value.");
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getKey());

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
    // Pin the algorithm — never let the token's own header choose how it's verified.
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null; // expired / tampered / missing secret
  }
}

export async function clearSession() {
  (await cookies()).delete(cookieName);
}
