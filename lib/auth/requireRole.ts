import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, Role, SessionPayload } from "./session";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The JWT alone used to be trusted for its full 7-day life — so deactivating a staff
 * account, or changing a stolen password, left the old session fully working for up to a
 * week. Now every protected action re-checks the account is still ACTIVE and that the
 * token's session version still matches (changePassword bumps it).
 *
 * Wrapped in React's per-request cache(): a page that calls five server actions does ONE
 * indexed _id lookup, not five.
 */
const loadAccountState = cache(async (userId: string) => {
  await connectToDatabase();
  return User.findById(userId)
    .select("status sessionVersion")
    .lean<{ status: string; sessionVersion?: number } | null>();
});

/** Every protected server action starts with one of these two calls. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  const account = await loadAccountState(session.userId);
  // Redirect (not throw): middleware only checks the JWT signature, so a revoked session
  // still reaches pages — throwing here produced a generic error screen with no way out.
  // The signout route clears the cookie and explains on the login page.
  if (!account || account.status !== "ACTIVE") redirect("/api/auth/signout?reason=inactive");
  if ((account.sessionVersion ?? 0) !== (session.sv ?? 0)) redirect("/api/auth/signout?reason=expired");
  return session;
}

export async function requireRole(allowed: Role[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) throw new ForbiddenError();
  return session;
}

/** Students may only ever act on their own studentId — never trust a client-supplied one. */
export function assertOwnStudentRecord(session: SessionPayload, studentId: string) {
  if (session.role !== "STUDENT") return; // staff roles are checked separately by requireRole
  if (session.studentId !== studentId) {
    throw new ForbiddenError("You can only access your own records.");
  }
}
