import mongoose from "mongoose";
import dns from "node:dns";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not set in the environment");
}

// Node's own DNS resolver (used internally for mongodb+srv:// SRV lookups) has a known
// bug on WINDOWS where it ignores the OS network adapter's configured DNS servers and
// fails with `querySrv ECONNREFUSED`, even when the OS-level DNS is set correctly. This
// forces Node itself to use Google DNS for this process, sidestepping that entirely.
//
// LOCAL DEV ONLY: on Vercel this was actively causing the ~20s-per-login slowdown — every
// mongodb+srv:// connect needs an SRV *and* a TXT DNS lookup, and routing both through an
// external public resolver (8.8.8.8) from inside Vercel's serverless network is far slower
// than the platform's own DNS, sometimes timing out and retrying. `VERCEL` is set to "1" on
// every Vercel deployment (production, preview, and `vercel dev`), so this now only applies
// on a plain local machine where the Windows bug above can actually occur.
if (MONGODB_URI.startsWith("mongodb+srv://") && !process.env.VERCEL) {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

/**
 * Cache the connection across hot reloads / server-action invocations so we
 * don't open a new connection on every request (critical once the copy count
 * gets into the millions — see architecture doc §33).
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
      // Node sometimes tries IPv6 to Atlas first, times out after several seconds, then
      // falls back to IPv4 — this is the classic cause of a "connect always takes 10-15s"
      // symptom on Windows. Forcing IPv4 skips that failed attempt entirely.
      family: 4,
      // Fail fast instead of hanging on the (long) driver defaults — a real network
      // problem should surface as a quick, clear error well inside the 5s login budget,
      // not a 30s+ silent wait. (socketTimeoutMS is deliberately left generous — unlike
      // the two above, it bounds every later query on this connection, not just the
      // initial handshake, and a report/aggregation elsewhere in the app needs more room.)
      serverSelectionTimeoutMS: 4500,
      connectTimeoutMS: 4500,
      socketTimeoutMS: 20000,
      // Keep at least one connection open in the pool at all times instead of opening one
      // from cold on the first query after any idle period — this is the "keep a warm
      // connection ready" half of the fix; instrumentation.ts (server boot) is the other
      // half, so the very first real request never pays the connect cost either.
      minPoolSize: 1,
      // 5 per serverless instance (was 10): Atlas M0/M2 caps total connections at 500, and
      // under a traffic spike Vercel runs many instances at once — 10 each (+ monitoring
      // sockets) exhausted the cap at ~30 instances and new requests failed to connect.
      maxPoolSize: 5,
      // Close sockets idle for 60s (the one minPoolSize connection stays warm) so frozen
      // instances don't sit on connections the cluster needs elsewhere.
      maxIdleTimeMS: 60000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Without this, one failed attempt (a network blip, Atlas IP list not yet updated,
    // etc.) poisons the cache forever — every request after that instantly re-awaits the
    // same rejected promise until the dev server is restarted, which then pays the full
    // slow-connect cost again. Clearing it lets the *next* request try a fresh connection.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
