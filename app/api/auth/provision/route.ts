import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ensureUserProfile, recordLogin } from "@/lib/repositories/users";

/**
 * Runs before every sign-in, for every provider. For an admin-created
 * email/PIN account this is a no-op existence check. For a Google sign-in
 * with no QIDMA profile yet, it creates one with the default "volunteer"
 * role and sets the matching custom claim.
 *
 * The ID token passed in was minted before any claim this call sets, so it
 * cannot itself carry that claim — the client must force-refresh its ID
 * token after calling this, before exchanging it for a session cookie at
 * /api/auth/session. That is why provisioning and session-minting are two
 * separate requests rather than one.
 */
export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const profile = await ensureUserProfile(decoded.uid, {
      name: (decoded.name as string | undefined) ?? "",
      email: decoded.email ?? "",
    });

    if (profile.disabled) {
      return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
    }

    await recordLogin(decoded.uid);

    return NextResponse.json({ success: true, role: profile.role });
  } catch (error) {
    console.error("Provisioning failed:", error);
    return NextResponse.json({ error: "Could not sign in." }, { status: 401 });
  }
}
