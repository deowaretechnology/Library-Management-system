/**
 * This same config file is used by two different runtimes, which expose env vars
 * differently:
 *  - Next.js (embedded Studio at /studio) reads NEXT_PUBLIC_* vars.
 *  - The standalone `sanity dev`/`sanity build` CLI (npm run studio) only understands
 *    its own SANITY_STUDIO_* convention, not Next's NEXT_PUBLIC_* prefix.
 * Both prefixes are set in .env.local, and each accessor here checks SANITY_STUDIO_*
 * first, falling back to NEXT_PUBLIC_*, so this file works unmodified in either runtime.
 */
export const projectId = assertValue(
  process.env.SANITY_STUDIO_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  "Missing SANITY_STUDIO_PROJECT_ID / NEXT_PUBLIC_SANITY_PROJECT_ID — set both in .env.local"
);

export const dataset = assertValue(
  process.env.SANITY_STUDIO_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET,
  "Missing SANITY_STUDIO_DATASET / NEXT_PUBLIC_SANITY_DATASET — set both in .env.local"
);

export const apiVersion =
  process.env.SANITY_STUDIO_API_VERSION || process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";

function assertValue<T>(value: T | undefined, errorMessage: string): T {
  if (value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}
