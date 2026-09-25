import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isStudentRoute = pathname.startsWith("/student");

  if (!isAdminRoute && !isStudentRoute) return NextResponse.next();

  const session = await getSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !ADMIN_ROLES.includes(session.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (isStudentRoute && session.role !== "STUDENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
