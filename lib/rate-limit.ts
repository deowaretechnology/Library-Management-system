/**
 * In-memory fixed-window rate limiter. This is per-process state: on Vercel each warm
 * serverless instance has its own Map, so the effective limit is "limit × instances".
 * It still stops the common case (one client hammering the login form), and callers now
 * layer several keys (per IP+ID, per IP, per ID). For a hard global limit, swap this for
 * Upstash Redis (@upstash/ratelimit) — same call signature.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;

function evictExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still over the cap (e.g. an attacker cycling random identifiers inside one window):
  // drop the oldest entries — Map iterates in insertion order.
  if (buckets.size > MAX_BUCKETS) {
    let excess = buckets.size - MAX_BUCKETS;
    for (const key of buckets.keys()) {
      if (excess-- <= 0) break;
      buckets.delete(key);
    }
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  // Previously nothing was ever deleted, so memory grew with every distinct key forever.
  if (buckets.size > MAX_BUCKETS) evictExpired(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Checks several limits at once; the request is allowed only if all of them allow it. */
export function rateLimitAll(
  rules: { key: string; limit: number; windowMs: number }[]
): { allowed: boolean; retryAfterMs: number } {
  let retryAfterMs = 0;
  let allowed = true;
  for (const rule of rules) {
    const r = rateLimit(rule.key, rule.limit, rule.windowMs);
    if (!r.allowed) {
      allowed = false;
      retryAfterMs = Math.max(retryAfterMs, r.retryAfterMs);
    }
  }
  return { allowed, retryAfterMs };
}

/**
 * Failure-only counters, for limits that must NOT count successful attempts: a whole
 * campus logs in from one shared Wi-Fi/NAT IP, so a per-IP limit on ALL attempts locked
 * everyone out once ~30 students signed in within five minutes.
 */
export function isBlocked(key: string, limit: number): { blocked: boolean; retryAfterMs: number } {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now) return { blocked: false, retryAfterMs: 0 };
  return bucket.count >= limit ? { blocked: true, retryAfterMs: bucket.resetAt - now } : { blocked: false, retryAfterMs: 0 };
}

export function recordFailure(key: string, windowMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) evictExpired(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else bucket.count += 1;
}
