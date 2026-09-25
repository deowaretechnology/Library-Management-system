import { getSession, Role, SessionPayload } from "./session";

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

/** Every protected server action starts with one of these two calls. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
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
