import "server-only";

import { randomBytes } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UserProfile, UserRole } from "@/lib/types";

const users = () => adminDb.collection("users");

function toProfile(uid: string, data: FirebaseFirestore.DocumentData): UserProfile {
  return {
    uid,
    name: data.name,
    mobile: data.mobile,
    email: data.email,
    role: data.role,
    disabled: data.disabled ?? false,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
    lastLoginAt: data.lastLoginAt ?? null,
  };
}

export async function listUsers(): Promise<UserProfile[]> {
  const snapshot = await users().orderBy("name").get();
  return snapshot.docs.map((doc) => toProfile(doc.id, doc.data()));
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const doc = await users().doc(uid).get();
  return doc.exists ? toProfile(doc.id, doc.data()!) : null;
}

/**
 * Readable initial password. The administrator relays it over WhatsApp and the
 * volunteer changes it after first sign-in, which avoids depending on email
 * deliverability to volunteers.
 */
export function generateInitialPassword(): string {
  return `qidma-${randomBytes(4).toString("hex")}`;
}

export interface CreateUserInput {
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  createdBy: string;
}

export async function createUser(
  input: CreateUserInput
): Promise<{ profile: UserProfile; password: string }> {
  const password = generateInitialPassword();

  const authUser = await adminAuth.createUser({
    email: input.email,
    password,
    displayName: input.name,
  });

  // The role lives as a custom claim so it travels inside the session cookie
  // and costs no extra read per request.
  await adminAuth.setCustomUserClaims(authUser.uid, { role: input.role });

  const record = {
    name: input.name,
    mobile: input.mobile,
    email: input.email,
    role: input.role,
    disabled: false,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    lastLoginAt: null,
  };

  await users().doc(authUser.uid).set(record);

  return { profile: toProfile(authUser.uid, record), password };
}

export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  await adminAuth.updateUser(uid, { disabled });
  if (disabled) {
    // Ends any live session immediately rather than at cookie expiry.
    await adminAuth.revokeRefreshTokens(uid);
  }
  await users().doc(uid).update({ disabled });
}

export async function recordLogin(uid: string): Promise<void> {
  await users().doc(uid).update({ lastLoginAt: new Date().toISOString() });
}
