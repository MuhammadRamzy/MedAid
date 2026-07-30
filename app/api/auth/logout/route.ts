import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const cookie = cookies().get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid; clearing the cookie is enough.
    }
  }

  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
