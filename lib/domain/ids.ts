import { randomBytes } from "node:crypto";

/**
 * Human-readable unique IDs like "TXN-1727350000000-a1b2c3". The old `${prefix}-${Date.now()}`
 * collided whenever two counters/gate scanners acted in the same millisecond, which hit the
 * unique index and surfaced as an unexplained E11000 error to the librarian. 3 random bytes
 * (16.7M values) per millisecond makes that practically impossible.
 *
 * Deliberately contains no "_" — the Razorpay payment-link reference uses "_" as the
 * separator between a fineId and its per-attempt suffix (see lib/actions/payments.ts).
 */
export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}`;
}
