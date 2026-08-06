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
    // Accounts created before this field existed predate the approval
    // gate entirely — treat them as already approved rather than locking
    // out every admin and volunteer the first time this deploys.
    approved: data.approved ?? true,
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
 * Approved immediately: an admin creating the account already is the
 * approval, unlike the self-registration path below.
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
    approved: true,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    lastLoginAt: null,
  };

  await users().doc(authUser.uid).set(record);

  return { profile: toProfile(authUser.uid, record), pin };
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("That email address already has an account.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export interface SelfRegisterInput {
  name: string;
  mobile: string;
  email: string;
  pin: string;
}

/**
 * A volunteer creates their own account and chooses their own PIN — but
 * cannot sign in until an admin approves it (approved: false here). This is
 * the PIN-based counterpart to Google's auto-provisioning in
 * ensureUserProfile(); both land in the same pending state.
 */
export async function selfRegisterWithPin(input: SelfRegisterInput): Promise<UserProfile> {
  const authUser = await adminAuth
    .createUser({ email: input.email, password: input.pin, displayName: input.name })
    .catch((error) => {
      if (error?.errorInfo?.code === "auth/email-already-exists") {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    });

  await adminAuth.setCustomUserClaims(authUser.uid, { role: "volunteer" });

  const record = {
    name: input.name,
    mobile: input.mobile,
    email: input.email,
    role: "volunteer" as UserRole,
    disabled: false,
    approved: false,
    createdAt: new Date().toISOString(),
    createdBy: "self-signup",
    lastLoginAt: null,
  };

  await users().doc(authUser.uid).set(record);
  return toProfile(authUser.uid, record);
}

/**
 * Google sign-in auto-provisions a QIDMA account on first login — there is
 * no admin step first. Idempotent: returns the existing profile untouched if
 * one is already there (e.g. an admin-created account signing in via Google
 * for the first time links to the same profile rather than duplicating it).
 * New accounts default to the least-privileged role and are unapproved,
 * same as PIN self-registration — an admin still has to let them in.
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
    approved: false,
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

/** Lets a self-registered account actually sign in. */
export async function approveUser(uid: string): Promise<void> {
  await users().doc(uid).update({ approved: true });
}

/**
 * A signed-in user editing their own name/mobile — deliberately narrower
 * than the admin-only setUserRole/setUserDisabled above: nothing here can
 * touch role, approved or disabled.
 */
export async function updateOwnProfile(
  uid: string,
  updates: { name: string; mobile: string }
): Promise<void> {
  await users().doc(uid).update({ name: updates.name, mobile: updates.mobile });
  await adminAuth.updateUser(uid, { displayName: updates.name });
}

/** Changes the Firebase Auth password backing a user's PIN sign-in. */
export async function changeOwnPin(uid: string, newPin: string): Promise<void> {
  await adminAuth.updateUser(uid, { password: newPin });
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
