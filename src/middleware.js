import { NextResponse } from "next/server";

export async function middleware(request) {
  const url = request.nextUrl;
  const isAdminPath = url.pathname.startsWith("/admin");

  if (!isAdminPath) {
    return NextResponse.next();
  }

  const isSignInPath =
    url.pathname === "/admin/sign-in" ||
    url.pathname.startsWith("/admin/sign-in/");

  if (isSignInPath) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  const sessionToken = request.cookies.get("better-auth.session_token");

  if (!sessionToken) {
    const redirectUrl = new URL("/admin/sign-in", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
