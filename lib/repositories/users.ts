import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { generatePin } from "@/lib/domain/pin";
import type { UserProfile, UserRole } from "@/lib/types";

const users = () => adminDb.collection("users");

function toProfile(uid: string, data: FirebaseFirestore.DocumentData): UserProfile {
  return {
    uid,
    name: data.name,
    mobile: data.mobile ?? null,
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

export interface CreateUserInput {
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  createdBy: string;
}

/**
 * Admin-created account. The 6-digit PIN is relayed to the volunteer over
 * WhatsApp and shown once — it is this account's Firebase Auth password,
 * chosen for the length purely because 6 digits is Firebase's own minimum.
 */
export async function createUser(
  input: CreateUserInput
): Promise<{ profile: UserProfile; pin: string }> {
  const pin = generatePin();

  const authUser = await adminAuth.createUser({
    email: input.email,
    password: pin,
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

  return { profile: toProfile(authUser.uid, record), pin };
}

/**
 * Google sign-in auto-provisions a QIDMA account on first login — there is
 * no admin step first. Idempotent: returns the existing profile untouched if
 * one is already there (e.g. an admin-created account signing in via Google
 * for the first time links to the same profile rather than duplicating it).
 * New accounts default to the least-privileged role; an admin promotes from
 * the Volunteers screen.
 */
export async function ensureUserProfile(
  uid: string,
  fallback: { name: string; email: string }
): Promise<UserProfile> {
  const ref = users().doc(uid);
  const existing = await ref.get();
  if (existing.exists) return toProfile(existing.id, existing.data()!);

  const record = {
    name: fallback.name || fallback.email,
    mobile: null,
    email: fallback.email,
    role: "volunteer" as UserRole,
    disabled: false,
    createdAt: new Date().toISOString(),
    createdBy: "self-signup",
    lastLoginAt: null,
  };

  await ref.set(record);
  await adminAuth.setCustomUserClaims(uid, { role: "volunteer" });

  return toProfile(uid, record);
}

export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  await adminAuth.updateUser(uid, { disabled });
  if (disabled) {
    // Ends any live session immediately rather than at cookie expiry.
    await adminAuth.revokeRefreshTokens(uid);
  }
  await users().doc(uid).update({ disabled });
}

/** Changes take effect immediately: the role claim is what's in the session cookie. */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, { role });
  await adminAuth.revokeRefreshTokens(uid);
  await users().doc(uid).update({ role });
}

/**
 * Removes the account entirely — both the Firebase Auth user and the
 * Firestore profile. Historical allocations are unaffected: they store the
 * acting user's name at the time of the action rather than looking it up
 * live, so deleting an account never blanks out past ledger entries.
 */
export async function deleteUser(uid: string): Promise<void> {
  await adminAuth.deleteUser(uid).catch((error) => {
    // Already gone from Auth (e.g. removed directly in the console); the
    // Firestore profile still needs cleaning up.
    if (error?.errorInfo?.code !== "auth/user-not-found") throw error;
  });
  await users().doc(uid).delete();
}

export async function recordLogin(uid: string): Promise<void> {
  await users().doc(uid).update({ lastLoginAt: new Date().toISOString() });
}
