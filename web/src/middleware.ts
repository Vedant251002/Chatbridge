import { NextRequest, NextResponse } from "next/server";

// Edge-safe gate. We only check that the cookie exists — full validation
// (DB lookup) happens in route handlers and server components via getCurrentUser().
// This stops anonymous traffic from ever reaching protected pages/APIs.

const SESSION_COOKIE = "wa_admin_session";

const PUBLIC_PAGES = new Set(["/login", "/register"]);
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/health"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;

  const isPublicPage = PUBLIC_PAGES.has(pathname);
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublicPage || isPublicApi) {
    // Already signed in? Don't loop the user through /login or /register.
    if ((pathname === "/login" || pathname === "/register") && hasSession) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Match every route except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
