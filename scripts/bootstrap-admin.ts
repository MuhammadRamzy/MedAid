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

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const mobile = process.env.BOOTSTRAP_ADMIN_MOBILE;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!name || !email || !mobile || !password) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_MOBILE and " +
        "BOOTSTRAP_ADMIN_PASSWORD in .env.local first."
    );
  }
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local first."
    );
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

  const user = await adminAuth.createUser({ email, password, displayName: name });
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

  console.log(`Created administrator ${email}. Sign in, then clear the BOOTSTRAP_* values.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
