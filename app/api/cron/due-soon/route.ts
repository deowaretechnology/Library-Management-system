import { NextRequest, NextResponse } from "next/server";
import { runDueSoonSweepCore } from "@/lib/notifications/sweep";

// Give the daily sweep room on Vercel (default function limit is much shorter). The sweep
// itself is now batched, but a large library can still have thousands of active loans.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Configured as a Vercel Cron job in vercel.json (daily at 08:00 UTC). Vercel signs its
 * own cron requests with an Authorization: Bearer <CRON_SECRET> header automatically when
 * CRON_SECRET is set as an env var — this route just checks it matches. If you're not on
 * Vercel, point any external scheduler (GitHub Actions, a plain cron job with curl) at
 * this URL with the same header instead.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueSoonSweepCore();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] due-soon sweep failed:", err);
    return NextResponse.json({ ok: false, error: "Sweep failed — see function logs." }, { status: 500 });
  }
}
