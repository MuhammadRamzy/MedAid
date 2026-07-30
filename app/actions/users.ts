"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { messageForAuthError } from "@/lib/auth/errors";
import * as usersRepo from "@/lib/repositories/users";
import type { UserProfile, UserRole } from "@/lib/types";

export async function getUsersAction(): Promise<UserProfile[]> {
  try {
    await requireAdmin();
    return await usersRepo.listUsers();
  } catch (error) {
    console.error("getUsersAction failed:", error);
    return [];
  }
}

export async function createUserAction(data: {
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
}): Promise<{ success: boolean; profile?: UserProfile; password?: string; error?: string }> {
  try {
    const admin = await requireAdmin();

    if (!data.name.trim() || !data.mobile.trim() || !data.email.trim()) {
      return { success: false, error: "Name, mobile and email are all required." };
    }

    const { profile, password } = await usersRepo.createUser({
      name: data.name.trim(),
      mobile: data.mobile.trim(),
      email: data.email.trim().toLowerCase(),
      role: data.role,
      createdBy: admin.uid,
    });

    revalidatePath("/admin/users");
    return { success: true, profile, password };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    if (error instanceof Error && error.message.includes("email-already-exists")) {
      return { success: false, error: "That email address already has an account." };
    }
    console.error("createUserAction failed:", error);
    return { success: false, error: "Could not create the account." };
  }
}

export async function setUserDisabledAction(
  uid: string,
  disabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    if (admin.uid === uid) {
      return { success: false, error: "You cannot disable your own account." };
    }

    await usersRepo.setUserDisabled(uid, disabled);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("setUserDisabledAction failed:", error);
    return { success: false, error: "Could not update the account." };
  }
}
