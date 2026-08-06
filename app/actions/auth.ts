"use server";

import { isValidPin } from "@/lib/domain/pin";
import * as usersRepo from "@/lib/repositories/users";
import { EmailAlreadyRegisteredError } from "@/lib/repositories/users";
import { logActivity } from "@/lib/repositories/activity";

/**
 * Public — no session required, since this is how someone without an
 * account gets one. The created account is unapproved: it exists in
 * Firebase Auth and Firestore, but /api/auth/provision refuses to mint a
 * session for it until an admin approves it from the Volunteers screen.
 */
export async function selfRegisterAction(data: {
  name: string;
  mobile: string;
  email: string;
  pin: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const name = data.name.trim();
    const mobile = data.mobile.trim();
    const email = data.email.trim().toLowerCase();

    if (!name || !mobile || !email) {
      return { success: false, error: "Name, mobile and email are all required." };
    }
    if (!isValidPin(data.pin)) {
      return { success: false, error: "PIN must be exactly 6 digits." };
    }

    const profile = await usersRepo.selfRegisterWithPin({ name, mobile, email, pin: data.pin });

    await logActivity({
      actorUid: profile.uid,
      actorName: profile.name,
      action: "USER_SELF_REGISTERED",
      targetType: "user",
      targetId: profile.uid,
      summary: `${profile.name} requested access`,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { success: false, error: error.message };
    }
    console.error("selfRegisterAction failed:", error);
    return { success: false, error: "Could not create the account." };
  }
}
