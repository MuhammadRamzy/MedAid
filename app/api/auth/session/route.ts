import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { getUserProfile } from "@/lib/repositories/users";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const user = await adminAuth.getUser(decoded.uid);
    if (user.disabled) {
      return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
    }

    // Defense in depth: /api/auth/provision is the primary gate on approval,
    // but this route must not mint a session on its own if called directly.
    const profile = await getUserProfile(decoded.uid);
    if (profile && !profile.approved) {
      return NextResponse.json(
        { error: "Your account is awaiting administrator approval. Please check back soon." },
        { status: 403 }
      );
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    cookies().set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session exchange failed:", error);
    return NextResponse.json({ error: "Could not sign in." }, { status: 401 });
  }
}
