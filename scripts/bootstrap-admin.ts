/**
 * Creates the first administrator. Run once, locally:
 *   npm run bootstrap:admin
 * Then clear the BOOTSTRAP_* values from .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const mobile = process.env.BOOTSTRAP_ADMIN_MOBILE;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!name || !email || !mobile || !password) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_MOBILE and " +
        "BOOTSTRAP_ADMIN_PASSWORD in .env.local first."
    );
  }

  const { adminAuth, adminDb } = await import("../lib/firebase/admin");

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
