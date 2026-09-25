/**
 * Runs once when the Next.js server process boots (both `next dev` and `next start`) —
 * long before any user actually visits /login. By pre-warming the MongoDB connection
 * here instead of waiting for the first request to pay that cost, a real login only
 * ever has to do the actual query + bcrypt compare, not "connect + query".
 *
 * Guarded to the Node.js runtime only: instrumentation.ts's register() also runs under
 * the Edge runtime (which middleware.ts uses), and mongoose/the MongoDB driver aren't
 * Edge-compatible — importing them unconditionally would break the Edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { connectToDatabase } = await import("@/lib/db/mongodb");
    try {
      await connectToDatabase();
      console.log("[startup] MongoDB connection pre-warmed — logins won't pay the connect cost.");
    } catch (err) {
      // Don't crash server startup over a transient DB issue. The next real request will
      // simply retry the connection itself (see the cache-reset-on-failure in mongodb.ts).
      console.warn("[startup] Could not pre-warm the MongoDB connection:", err);
    }
  }
}
