/**
 * Creates the first administrator. Run once, locally:
 *   npm run bootstrap:admin
 * Then clear the BOOTSTRAP_* values from .env.local.
 *
 * This script initializes the Admin SDK itself rather than importing
 * lib/firebase/admin.ts: that module starts with `import "server-only"`,
 * a guard Next.js's webpack build aliases away — running it under plain
 * tsx (as this standalone script does) hits the real "server-only" package,
 * which throws unconditionally outside that build.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { isValidPin, generatePin } from "../lib/domain/pin";

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const mobile = process.env.BOOTSTRAP_ADMIN_MOBILE;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!name || !email || !mobile) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_MOBILE in .env.local first."
    );
  }
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local first."
    );
  }

  // Login now uses a 6-digit PIN, not a free-form password. Accept one from
  // BOOTSTRAP_ADMIN_PIN if it's valid; otherwise generate one so this script
  // still works when that variable is missing or holds an old-style password.
  const requestedPin = process.env.BOOTSTRAP_ADMIN_PIN;
  const pin = requestedPin && isValidPin(requestedPin) ? requestedPin : generatePin();
  if (requestedPin && !isValidPin(requestedPin)) {
    console.warn(`BOOTSTRAP_ADMIN_PIN "${requestedPin}" is not 6 digits — generated a new one instead.`);
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
  });
  const adminAuth = getAuth(app);
  const adminDb = getFirestore(app);

  const existing = await adminDb.collection("users").where("role", "==", "admin").limit(1).get();
  if (!existing.empty) {
    console.log("An administrator already exists. Nothing to do.");
    return;
  }

  const user = await adminAuth.createUser({ email, password: pin, displayName: name });
  await adminAuth.setCustomUserClaims(user.uid, { role: "admin" });
  await adminDb.collection("users").doc(user.uid).set({
    name,
    mobile,
    email,
    role: "admin",
    disabled: false,
    createdAt: new Date().toISOString(),
    createdBy: "bootstrap",
    lastLoginAt: null,
  });

  console.log(`Created administrator ${email}.`);
  console.log(`PIN: ${pin}`);
  console.log("Sign in, then clear the BOOTSTRAP_* values.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
