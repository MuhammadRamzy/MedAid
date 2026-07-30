import "server-only";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import type { SessionUser, UserRole } from "@/lib/types";
import { AuthError, ForbiddenError } from "./errors";

export const SESSION_COOKIE = "qidma_session";

/** Firebase caps session cookies at 14 days. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: true so a disabled volunteer loses access immediately
    // rather than at cookie expiry.
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    const role = decoded.role as UserRole | undefined;
    if (role !== "admin" && role !== "volunteer") return null;

    return { uid: decoded.uid, email: decoded.email ?? "", role };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}
