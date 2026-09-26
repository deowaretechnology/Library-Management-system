import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

/**
 * Where a request with a no-longer-valid session is sent (account deactivated, or signed
 * out everywhere by a password change). Cookies can't be changed while a page is rendering,
 * so requireSession() redirects here; this clears the cookie and lands on the login page
 * with an explanation — instead of the old behaviour of an unhandled error screen.
 */
export async function GET(request: NextRequest) {
  await clearSession();
  const reason = request.nextUrl.searchParams.get("reason") === "inactive" ? "inactive" : "expired";
  return NextResponse.redirect(new URL(`/login?${reason}=1`, request.url));
}
