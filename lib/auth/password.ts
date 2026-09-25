import bcrypt from "bcryptjs";

// 10 is still a secure bcrypt cost factor (OWASP's accepted floor) and roughly 4x faster
// to *verify* than 12 — the single biggest chunk of per-login CPU time once the DB
// connection is already warm. Safe to lower with no migration: bcrypt embeds its own
// cost factor in every hash, so existing password hashes keep verifying correctly
// regardless of this constant — only *new* hashes (new accounts, password resets) use it.
const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
