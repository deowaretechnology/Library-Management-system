import { NextRequest, NextResponse } from "next/server";
import { runDueSoonSweepCore } from "@/lib/notifications/sweep";

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

  const result = await runDueSoonSweepCore();
  return NextResponse.json({ ok: true, ...result });
}
