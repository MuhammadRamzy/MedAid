import { NextResponse, type NextRequest } from "next/server";

// Middleware runs on the Edge runtime, where firebase-admin cannot run. It
// therefore checks only that a session cookie is PRESENT — it cannot verify
// it. Real authorization happens in every server action. This exists purely so
// signed-out visitors land on the login page instead of an empty dashboard.
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("qidma_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|logo.png|manifest.json|sw.js).*)"],
};
