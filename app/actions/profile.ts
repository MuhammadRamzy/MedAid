"use server";

import { requireUser } from "@/lib/auth/session";
import { messageForAuthError } from "@/lib/auth/errors";
import { isValidPin } from "@/lib/domain/pin";
import * as usersRepo from "@/lib/repositories/users";
import type { UserProfile } from "@/lib/types";

/** Any signed-in user's own profile — not gated to admins like getUsersAction. */
export async function getOwnProfileAction(): Promise<UserProfile | null> {
  try {
    const user = await requireUser();
    return await usersRepo.getUserProfile(user.uid);
  } catch (error) {
    console.error("getOwnProfileAction failed:", error);
    return null;
  }
}

export async function updateOwnProfileAction(data: {
  name: string;
  mobile: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const name = data.name.trim();
    const mobile = data.mobile.trim();
    if (!name) return { success: false, error: "Name is required." };

    await usersRepo.updateOwnProfile(user.uid, { name, mobile });
    return { success: true };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("updateOwnProfileAction failed:", error);
    return { success: false, error: "Could not update your profile." };
  }
}

/**
 * Changes the user's own PIN. Verifies the current PIN first via the same
 * Identity Toolkit REST endpoint the login page's client SDK calls under
 * the hood — the Admin SDK has no "check this password" call, only
 * "set this password", so re-authentication has to go over the wire.
 */
export async function changeOwnPinAction(data: {
  currentPin: string;
  newPin: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    if (!isValidPin(data.newPin)) {
      return { success: false, error: "New PIN must be exactly 6 digits." };
    }
    if (data.newPin === data.currentPin) {
      return { success: false, error: "New PIN must be different from your current PIN." };
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("changeOwnPinAction: NEXT_PUBLIC_FIREBASE_API_KEY is not set");
      return { success: false, error: "Could not change your PIN." };
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: data.currentPin,
          returnSecureToken: true,
        }),
      }
    );
    if (!verifyRes.ok) {
      return { success: false, error: "Your current PIN is incorrect." };
    }

    await usersRepo.changeOwnPin(user.uid, data.newPin);
    return { success: true };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("changeOwnPinAction failed:", error);
    return { success: false, error: "Could not change your PIN." };
  }
}
