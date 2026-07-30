# QIDMA Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ephemeral JSON data layer with Firestore, put the app behind Firebase Auth with admin/volunteer roles, and rebrand to QIDMA Medical Aid — with every existing screen still working.

**Architecture:** The browser uses the Firebase client SDK for sign-in only and never touches Firestore. Sign-in produces an ID token, which is exchanged at `/api/auth/session` for an httpOnly session cookie minted by the Admin SDK. Server actions verify that cookie, then read and write Firestore through the Admin SDK. Pure domain rules live in `lib/domain/` as Firebase-free functions so they can be unit-tested without an emulator.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Firebase Admin SDK, Firebase JS SDK (auth only), Firestore, Tailwind, Vitest, tsx.

## Global Constraints

- All monetary amounts are INR. No currency field is stored anywhere.
- Dates and timestamps are stored in Firestore as **ISO 8601 strings**, never Firestore `Timestamp` objects. Server Action return values cross the server/client boundary and must be JSON-serializable; `Timestamp` is not.
- Product name is **QIDMA Medical Aid**; tagline is **By KMCC Qatar Vanimal Panchayat**. Use these exact strings.
- Receipt numbers use the format `QID-{year}-{seq padded to 4}`, e.g. `QID-2026-0001`.
- `lib/types.ts` must import nothing. It is imported by client components.
- Any module touching `firebase-admin` must start with `import "server-only";`.
- Middleware runs on the Edge runtime where `firebase-admin` cannot run. Middleware checks only for cookie *presence*. Real authorization happens in server actions.
- Role values are exactly `admin` and `volunteer`.
- Item status values are exactly `AVAILABLE`, `ALLOCATED`, `MAINTENANCE`, `RETIRED`.
- No new fields from Phases 2–4 (acquisition, contributions, activity log) are added in this phase.

---

### Task 1: Vitest and the condition→status rule

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/domain/condition.ts`
- Test: `lib/domain/condition.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `type Condition`, `type ItemStatus`, `statusForCondition(condition: Condition): ItemStatus`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest tsx
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

In the `"scripts"` block, add:

```json
"test": "vitest",
"test:run": "vitest run",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Write the failing test**

Create `lib/domain/condition.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { statusForCondition } from "./condition";

describe("statusForCondition", () => {
  it("makes a new device available", () => {
    expect(statusForCondition("New")).toBe("AVAILABLE");
  });

  it("makes a used device available", () => {
    expect(statusForCondition("Used")).toBe("AVAILABLE");
  });

  it("makes a good device available", () => {
    expect(statusForCondition("Good")).toBe("AVAILABLE");
  });

  it("makes a fair device available", () => {
    expect(statusForCondition("Fair")).toBe("AVAILABLE");
  });

  it("sends a device needing repair to maintenance", () => {
    expect(statusForCondition("Needs Repair")).toBe("MAINTENANCE");
  });

  it("retires a retired device", () => {
    expect(statusForCondition("Retired")).toBe("RETIRED");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run lib/domain/condition.test.ts`
Expected: FAIL — cannot find module `./condition`.

- [ ] **Step 6: Write the implementation**

Create `lib/domain/condition.ts`:

```ts
export type Condition =
  | "New"
  | "Used"
  | "Good"
  | "Fair"
  | "Needs Repair"
  | "Retired";

export type ItemStatus = "AVAILABLE" | "ALLOCATED" | "MAINTENANCE" | "RETIRED";

/** Conditions offered when registering a device. */
export const REGISTRATION_CONDITIONS: Condition[] = ["New", "Used", "Needs Repair"];

/** Conditions offered when a device is returned. */
export const RETURN_CONDITIONS: Condition[] = ["Good", "Fair", "Needs Repair", "Retired"];

/**
 * A device's condition determines its status, at registration and at return
 * alike. A device recorded as needing repair is never offered for lending.
 */
export function statusForCondition(condition: Condition): ItemStatus {
  switch (condition) {
    case "Needs Repair":
      return "MAINTENANCE";
    case "Retired":
      return "RETIRED";
    default:
      return "AVAILABLE";
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run lib/domain/condition.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json lib/domain/condition.ts lib/domain/condition.test.ts
git commit -m "feat: add vitest and condition-to-status domain rule"
```

---

### Task 2: Overdue derivation and receipt formatting

**Files:**
- Create: `lib/domain/allocation.ts`
- Create: `lib/domain/receipt.ts`
- Test: `lib/domain/allocation.test.ts`
- Test: `lib/domain/receipt.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type AllocationStatus = "ACTIVE" | "RETURNED"`
  - `type DerivedAllocationStatus = "ACTIVE" | "RETURNED" | "OVERDUE"`
  - `deriveStatus(stored: AllocationStatus, expectedReturnAt: string, now: Date): DerivedAllocationStatus`
  - `formatReceiptNumber(year: number, seq: number): string`
  - `nextSequence(current: { year: number; seq: number } | null, year: number): number`

- [ ] **Step 1: Write the failing allocation test**

Create `lib/domain/allocation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveStatus } from "./allocation";

const NOW = new Date("2026-07-30T12:00:00.000Z");

describe("deriveStatus", () => {
  it("reports an active allocation past its return date as overdue", () => {
    expect(deriveStatus("ACTIVE", "2026-07-01T00:00:00.000Z", NOW)).toBe("OVERDUE");
  });

  it("leaves an active allocation before its return date active", () => {
    expect(deriveStatus("ACTIVE", "2026-08-30T00:00:00.000Z", NOW)).toBe("ACTIVE");
  });

  it("never reports a returned allocation as overdue", () => {
    expect(deriveStatus("RETURNED", "2026-07-01T00:00:00.000Z", NOW)).toBe("RETURNED");
  });

  it("treats the exact return moment as not yet overdue", () => {
    expect(deriveStatus("ACTIVE", NOW.toISOString(), NOW)).toBe("ACTIVE");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/domain/allocation.test.ts`
Expected: FAIL — cannot find module `./allocation`.

- [ ] **Step 3: Implement allocation status derivation**

Create `lib/domain/allocation.ts`:

```ts
export type AllocationStatus = "ACTIVE" | "RETURNED";
export type DerivedAllocationStatus = AllocationStatus | "OVERDUE";

/**
 * OVERDUE is never stored. It is derived on read from the stored status and
 * the expected return date, so a lapsed deadline needs no background job.
 */
export function deriveStatus(
  stored: AllocationStatus,
  expectedReturnAt: string,
  now: Date
): DerivedAllocationStatus {
  if (stored !== "ACTIVE") return stored;
  return new Date(expectedReturnAt).getTime() < now.getTime() ? "OVERDUE" : "ACTIVE";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/domain/allocation.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing receipt test**

Create `lib/domain/receipt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatReceiptNumber, nextSequence } from "./receipt";

describe("formatReceiptNumber", () => {
  it("pads the sequence to four digits", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("QID-2026-0001");
  });

  it("does not truncate sequences beyond four digits", () => {
    expect(formatReceiptNumber(2026, 12345)).toBe("QID-2026-12345");
  });
});

describe("nextSequence", () => {
  it("starts at one when no counter exists", () => {
    expect(nextSequence(null, 2026)).toBe(1);
  });

  it("increments within the same year", () => {
    expect(nextSequence({ year: 2026, seq: 7 }, 2026)).toBe(8);
  });

  it("restarts at one in a new year", () => {
    expect(nextSequence({ year: 2025, seq: 400 }, 2026)).toBe(1);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run lib/domain/receipt.test.ts`
Expected: FAIL — cannot find module `./receipt`.

- [ ] **Step 7: Implement receipt numbering**

Create `lib/domain/receipt.ts`:

```ts
/**
 * Receipt numbers come from a persisted counter, never from a collection
 * count. A count-based scheme reuses numbers after any deletion, on a
 * document the beneficiary keeps.
 */
export function formatReceiptNumber(year: number, seq: number): string {
  return `QID-${year}-${String(seq).padStart(4, "0")}`;
}

export function nextSequence(
  current: { year: number; seq: number } | null,
  year: number
): number {
  if (!current || current.year !== year) return 1;
  return current.seq + 1;
}
```

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS — 13 tests across 3 files.

- [ ] **Step 9: Commit**

```bash
git add lib/domain/allocation.ts lib/domain/allocation.test.ts lib/domain/receipt.ts lib/domain/receipt.test.ts
git commit -m "feat: add overdue derivation and receipt numbering rules"
```

---

### Task 3: Extract shared domain types

**Files:**
- Create: `lib/types.ts`
- Modify: `app/page.tsx:5`, `app/allocations/page.tsx:4`, `app/inventory/page.tsx:5`, `app/receipt/[id]/page.tsx:4`, `components/checkout-cart.tsx:4`

**Interfaces:**
- Consumes: `Condition`, `ItemStatus` from `lib/domain/condition.ts`; `AllocationStatus`, `DerivedAllocationStatus` from `lib/domain/allocation.ts`
- Produces: `Item`, `Beneficiary`, `Allocation`, `AllocationWithRefs`, `UserProfile`, `UserRole`, `SessionUser` from `@/lib/types`

Client components currently import types from `lib/db-service.ts`. That file is about to import `firebase-admin`, a server-only package. Types move out first so no client component ever references it.

- [ ] **Step 1: Create the types module**

Create `lib/types.ts`:

```ts
import type { Condition, ItemStatus } from "@/lib/domain/condition";
import type { AllocationStatus, DerivedAllocationStatus } from "@/lib/domain/allocation";

export type { Condition, ItemStatus, AllocationStatus, DerivedAllocationStatus };

export type UserRole = "admin" | "volunteer";

export interface Item {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: ItemStatus;
  condition: Condition;
  currentAllocationId: string | null;
}

export interface Beneficiary {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface Allocation {
  id: string;
  itemId: string;
  beneficiaryId: string;
  allocatedAt: string;
  allocatedBy: string;
  expectedReturnAt: string;
  actualReturnedAt: string | null;
  checkedInBy: string | null;
  conditionOnReturn: Condition | null;
  status: AllocationStatus;
  notes: string;
  receiptNumber: string;
}

export interface AllocationWithRefs extends Omit<Allocation, "status"> {
  status: DerivedAllocationStatus;
  item?: Item;
  beneficiary?: Beneficiary;
  allocatedByName?: string;
  checkedInByName?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
  createdBy: string;
  lastLoginAt: string | null;
}

export interface SessionUser {
  uid: string;
  email: string;
  role: UserRole;
}
```

Note the deliberate changes from the old shapes: `conditionOnCheckIn` on `Item` becomes `condition`; `Beneficiary.volunteerInCharge` is gone, superseded by `Allocation.allocatedBy`; `Allocation` gains `allocatedBy`, `checkedInBy` and `conditionOnReturn`.

- [ ] **Step 2: Repoint every client import**

In each of these five files, change the import source from `@/lib/db-service` to `@/lib/types`:

- `app/page.tsx` line 5
- `app/allocations/page.tsx` line 4
- `app/inventory/page.tsx` line 5
- `app/receipt/[id]/page.tsx` line 4
- `components/checkout-cart.tsx` line 4

For example, in `app/page.tsx`:

```ts
import { Item, Beneficiary, AllocationWithRefs } from "@/lib/types";
```

Where a file previously declared the inline intersection type `(Allocation & { item?: Item; beneficiary?: Beneficiary })`, replace it with `AllocationWithRefs`.

- [ ] **Step 3: Verify types still resolve**

Run: `npx tsc --noEmit`
Expected: errors only about `conditionOnCheckIn` and `volunteerInCharge` no longer existing, and about `lib/db-service.ts` shapes. These are expected — later tasks fix the call sites. Note which files error; they are the ones Tasks 9 and 13 must revisit.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts app/page.tsx app/allocations/page.tsx app/inventory/page.tsx "app/receipt/[id]/page.tsx" components/checkout-cart.tsx
git commit -m "refactor: extract domain types to client-safe lib/types"
```

---

### Task 4: Firebase SDK initialization

**Files:**
- Create: `lib/firebase/admin.ts`
- Create: `lib/firebase/client.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `adminDb: Firestore`, `adminAuth: Auth` from `@/lib/firebase/admin`; `clientAuth: Auth` from `@/lib/firebase/client`

- [ ] **Step 1: Install the SDKs**

```bash
npm install firebase firebase-admin server-only
```

- [ ] **Step 2: Create the Admin SDK singleton**

Create `lib/firebase/admin.ts`:

```ts
import "server-only";

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in, ` +
        `and add the same variable to the Vercel project settings.`
    );
  }
  return value;
}

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  return initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      // Vercel stores the PEM with literal \n sequences rather than newlines.
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

export const adminDb = getFirestore(adminApp());
export const adminAuth = getAuth(adminApp());
```

- [ ] **Step 3: Create the client SDK singleton**

Create `lib/firebase/client.ts`:

```ts
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Used for signInWithEmailAndPassword only. This app never reads Firestore
// from the browser; Firestore rules deny all client access.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function clientApp(): FirebaseApp {
  return getApps().length > 0 ? getApps()[0] : initializeApp(config);
}

export const clientAuth: Auth = getAuth(clientApp());
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files. Pre-existing errors from Task 3 remain.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/firebase/admin.ts lib/firebase/client.ts
git commit -m "feat: initialize firebase admin and client SDKs"
```

---

### Task 5: Session cookies and authorization guards

**Files:**
- Create: `lib/auth/session.ts`
- Create: `app/api/auth/session/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Test: `lib/auth/errors.test.ts`
- Create: `lib/auth/errors.ts`

**Interfaces:**
- Consumes: `adminAuth` from `@/lib/firebase/admin`; `SessionUser`, `UserRole` from `@/lib/types`
- Produces:
  - `AuthError`, `ForbiddenError`, `messageForAuthError(e: unknown): string | null` from `@/lib/auth/errors`
  - `getSessionUser(): Promise<SessionUser | null>`, `requireUser(): Promise<SessionUser>`, `requireAdmin(): Promise<SessionUser>` from `@/lib/auth/session`
  - `SESSION_COOKIE = "qidma_session"`

- [ ] **Step 1: Write the failing error-mapping test**

Create `lib/auth/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AuthError, ForbiddenError, messageForAuthError } from "./errors";

describe("messageForAuthError", () => {
  it("maps a missing session to a sign-in message", () => {
    expect(messageForAuthError(new AuthError())).toBe("Please sign in again.");
  });

  it("maps insufficient role to a permission message", () => {
    expect(messageForAuthError(new ForbiddenError())).toBe(
      "You do not have permission to do that."
    );
  });

  it("returns null for unrelated errors so callers can handle them", () => {
    expect(messageForAuthError(new Error("firestore unavailable"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/auth/errors.test.ts`
Expected: FAIL — cannot find module `./errors`.

- [ ] **Step 3: Implement the errors**

Create `lib/auth/errors.ts`:

```ts
export class AuthError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "ForbiddenError";
  }
}

/**
 * Server actions return { success, error } rather than throwing across the
 * boundary. This maps guard failures to text safe to show a volunteer, and
 * returns null for anything else so real faults are not masked.
 */
export function messageForAuthError(error: unknown): string | null {
  if (error instanceof AuthError) return "Please sign in again.";
  if (error instanceof ForbiddenError) return "You do not have permission to do that.";
  return null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/auth/errors.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Implement the session helpers**

Create `lib/auth/session.ts`:

```ts
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
```

- [ ] **Step 6: Create the session exchange route**

Create `app/api/auth/session/route.ts`:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const user = await adminAuth.getUser(decoded.uid);
    if (user.disabled) {
      return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    cookies().set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session exchange failed:", error);
    return NextResponse.json({ error: "Could not sign in." }, { status: 401 });
  }
}
```

- [ ] **Step 7: Create the logout route**

Create `app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const cookie = cookies().get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid; clearing the cookie is enough.
    }
  }

  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/auth app/api/auth
git commit -m "feat: add session cookie exchange and authorization guards"
```

---

### Task 6: Items and beneficiaries repositories

**Files:**
- Create: `lib/repositories/items.ts`
- Create: `lib/repositories/beneficiaries.ts`

**Interfaces:**
- Consumes: `adminDb` from `@/lib/firebase/admin`; `Item`, `Beneficiary`, `Condition` from `@/lib/types`; `statusForCondition` from `@/lib/domain/condition`
- Produces:
  - `listItems(): Promise<Item[]>`, `getItem(id): Promise<Item | null>`, `createItem(input): Promise<Item>`, `updateItem(id, updates): Promise<Item | null>`, `deleteItem(id): Promise<boolean>`, `assetTagExists(assetTag): Promise<boolean>`
  - `listBeneficiaries(): Promise<Beneficiary[]>`, `getBeneficiary(id): Promise<Beneficiary | null>`, `findOrCreateBeneficiary(input, createdBy): Promise<Beneficiary>`

- [ ] **Step 1: Create the items repository**

Create `lib/repositories/items.ts`:

```ts
import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { statusForCondition } from "@/lib/domain/condition";
import type { Condition, Item } from "@/lib/types";

const items = () => adminDb.collection("items");

function toItem(id: string, data: FirebaseFirestore.DocumentData): Item {
  return {
    id,
    assetTag: data.assetTag,
    name: data.name,
    category: data.category,
    status: data.status,
    condition: data.condition,
    currentAllocationId: data.currentAllocationId ?? null,
  };
}

export async function listItems(): Promise<Item[]> {
  const snapshot = await items().orderBy("assetTag").get();
  return snapshot.docs.map((doc) => toItem(doc.id, doc.data()));
}

export async function getItem(id: string): Promise<Item | null> {
  const doc = await items().doc(id).get();
  return doc.exists ? toItem(doc.id, doc.data()!) : null;
}

export async function assetTagExists(assetTag: string): Promise<boolean> {
  const snapshot = await items()
    .where("assetTagLower", "==", assetTag.toLowerCase())
    .limit(1)
    .get();
  return !snapshot.empty;
}

export interface CreateItemInput {
  assetTag: string;
  name: string;
  category: string;
  condition: Condition;
  registeredAt: string;
  registeredBy: string;
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const ref = items().doc();
  const record = {
    assetTag: input.assetTag,
    // Stored lowercase alongside the display value because Firestore has no
    // case-insensitive query operator.
    assetTagLower: input.assetTag.toLowerCase(),
    name: input.name,
    category: input.category,
    condition: input.condition,
    status: statusForCondition(input.condition),
    currentAllocationId: null,
    registeredAt: input.registeredAt,
    registeredBy: input.registeredBy,
  };

  await ref.set(record);
  return toItem(ref.id, record);
}

export async function updateItem(
  id: string,
  updates: Partial<Pick<Item, "assetTag" | "name" | "category" | "condition" | "status">>
): Promise<Item | null> {
  const ref = items().doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const patch: FirebaseFirestore.DocumentData = { ...updates };
  if (updates.assetTag) patch.assetTagLower = updates.assetTag.toLowerCase();

  await ref.update(patch);
  const updated = await ref.get();
  return toItem(updated.id, updated.data()!);
}

export async function deleteItem(id: string): Promise<boolean> {
  const ref = items().doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;

  const allocations = await adminDb
    .collection("allocations")
    .where("itemId", "==", id)
    .get();

  const batch = adminDb.batch();
  allocations.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(ref);
  await batch.commit();

  return true;
}
```

- [ ] **Step 2: Create the beneficiaries repository**

Create `lib/repositories/beneficiaries.ts`:

```ts
import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Beneficiary } from "@/lib/types";

const beneficiaries = () => adminDb.collection("beneficiaries");

function toBeneficiary(id: string, data: FirebaseFirestore.DocumentData): Beneficiary {
  return {
    id,
    name: data.name,
    phone: data.phone,
    address: data.address,
  };
}

export async function listBeneficiaries(): Promise<Beneficiary[]> {
  const snapshot = await beneficiaries().orderBy("name").get();
  return snapshot.docs.map((doc) => toBeneficiary(doc.id, doc.data()));
}

export async function getBeneficiary(id: string): Promise<Beneficiary | null> {
  const doc = await beneficiaries().doc(id).get();
  return doc.exists ? toBeneficiary(doc.id, doc.data()!) : null;
}

export interface BeneficiaryInput {
  name: string;
  phone: string;
  address: string;
}

/**
 * Beneficiaries are created inline while lending; there is no registration
 * step. Repeat borrowers are matched on phone number so the ledger does not
 * accumulate duplicates of the same person.
 */
export async function findOrCreateBeneficiary(
  input: BeneficiaryInput,
  createdBy: string
): Promise<Beneficiary> {
  const existing = await beneficiaries().where("phone", "==", input.phone).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return toBeneficiary(doc.id, doc.data());
  }

  const ref = beneficiaries().doc();
  const record = {
    name: input.name,
    phone: input.phone,
    address: input.address,
    createdAt: new Date().toISOString(),
    createdBy,
  };

  await ref.set(record);
  return toBeneficiary(ref.id, record);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add lib/repositories/items.ts lib/repositories/beneficiaries.ts
git commit -m "feat: add items and beneficiaries firestore repositories"
```

---

### Task 7: Allocations repository with transactional lending

**Files:**
- Create: `lib/repositories/allocations.ts`

**Interfaces:**
- Consumes: `adminDb`; `deriveStatus` from `@/lib/domain/allocation`; `formatReceiptNumber`, `nextSequence` from `@/lib/domain/receipt`; `statusForCondition` from `@/lib/domain/condition`; `Allocation`, `AllocationWithRefs`, `Condition` from `@/lib/types`
- Produces: `listAllocations(): Promise<AllocationWithRefs[]>`, `getAllocation(id): Promise<AllocationWithRefs | null>`, `createAllocation(input): Promise<Allocation>`, `returnAllocation(input): Promise<Allocation | null>`

This is the task where correctness matters most: lending must be one transaction, or two volunteers can lend the same device.

- [ ] **Step 1: Create the allocations repository**

Create `lib/repositories/allocations.ts`:

```ts
import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { deriveStatus } from "@/lib/domain/allocation";
import { formatReceiptNumber, nextSequence } from "@/lib/domain/receipt";
import { statusForCondition } from "@/lib/domain/condition";
import type { Allocation, AllocationWithRefs, Condition, Item, Beneficiary } from "@/lib/types";

const allocations = () => adminDb.collection("allocations");

function toAllocation(id: string, data: FirebaseFirestore.DocumentData): Allocation {
  return {
    id,
    itemId: data.itemId,
    beneficiaryId: data.beneficiaryId,
    allocatedAt: data.allocatedAt,
    allocatedBy: data.allocatedBy,
    expectedReturnAt: data.expectedReturnAt,
    actualReturnedAt: data.actualReturnedAt ?? null,
    checkedInBy: data.checkedInBy ?? null,
    conditionOnReturn: data.conditionOnReturn ?? null,
    status: data.status,
    notes: data.notes ?? "",
    receiptNumber: data.receiptNumber,
  };
}

/**
 * Loads allocations with their item, beneficiary and acting user names.
 * Reads every collection once and joins in memory rather than issuing a query
 * per row. At committee scale this is the cheaper shape; if the inventory
 * grows into the thousands this needs pagination.
 */
export async function listAllocations(): Promise<AllocationWithRefs[]> {
  const [allocSnap, itemSnap, benSnap, userSnap] = await Promise.all([
    allocations().orderBy("allocatedAt", "desc").get(),
    adminDb.collection("items").get(),
    adminDb.collection("beneficiaries").get(),
    adminDb.collection("users").get(),
  ]);

  const itemsById = new Map<string, Item>(
    itemSnap.docs.map((d) => [
      d.id,
      {
        id: d.id,
        assetTag: d.data().assetTag,
        name: d.data().name,
        category: d.data().category,
        status: d.data().status,
        condition: d.data().condition,
        currentAllocationId: d.data().currentAllocationId ?? null,
      },
    ])
  );

  const bensById = new Map<string, Beneficiary>(
    benSnap.docs.map((d) => [
      d.id,
      { id: d.id, name: d.data().name, phone: d.data().phone, address: d.data().address },
    ])
  );

  const namesByUid = new Map<string, string>(
    userSnap.docs.map((d) => [d.id, d.data().name as string])
  );

  const now = new Date();

  return allocSnap.docs.map((doc) => {
    const base = toAllocation(doc.id, doc.data());
    return {
      ...base,
      status: deriveStatus(base.status, base.expectedReturnAt, now),
      item: itemsById.get(base.itemId),
      beneficiary: bensById.get(base.beneficiaryId),
      allocatedByName: namesByUid.get(base.allocatedBy),
      checkedInByName: base.checkedInBy ? namesByUid.get(base.checkedInBy) : undefined,
    };
  });
}

export async function getAllocation(id: string): Promise<AllocationWithRefs | null> {
  const doc = await allocations().doc(id).get();
  if (!doc.exists) return null;

  const base = toAllocation(doc.id, doc.data()!);
  const [itemDoc, benDoc] = await Promise.all([
    adminDb.collection("items").doc(base.itemId).get(),
    adminDb.collection("beneficiaries").doc(base.beneficiaryId).get(),
  ]);

  return {
    ...base,
    status: deriveStatus(base.status, base.expectedReturnAt, new Date()),
    item: itemDoc.exists
      ? {
          id: itemDoc.id,
          assetTag: itemDoc.data()!.assetTag,
          name: itemDoc.data()!.name,
          category: itemDoc.data()!.category,
          status: itemDoc.data()!.status,
          condition: itemDoc.data()!.condition,
          currentAllocationId: itemDoc.data()!.currentAllocationId ?? null,
        }
      : undefined,
    beneficiary: benDoc.exists
      ? {
          id: benDoc.id,
          name: benDoc.data()!.name,
          phone: benDoc.data()!.phone,
          address: benDoc.data()!.address,
        }
      : undefined,
  };
}

export class ItemUnavailableError extends Error {
  constructor(public readonly itemName: string) {
    super(`${itemName} is no longer available.`);
    this.name = "ItemUnavailableError";
  }
}

export interface CreateAllocationInput {
  itemId: string;
  beneficiaryId: string;
  expectedReturnAt: string;
  notes: string;
  allocatedBy: string;
}

/**
 * Creating the allocation, flipping the item to ALLOCATED and issuing the
 * receipt number all commit together. Firestore requires every read in a
 * transaction to happen before any write, hence the ordering below.
 */
export async function createAllocation(
  input: CreateAllocationInput
): Promise<Allocation> {
  const itemRef = adminDb.collection("items").doc(input.itemId);
  const counterRef = adminDb.collection("counters").doc("receipts");
  const allocRef = allocations().doc();

  const record = await adminDb.runTransaction(async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw new ItemUnavailableError("That device");

    const item = itemSnap.data()!;
    if (item.status !== "AVAILABLE") {
      throw new ItemUnavailableError(item.name as string);
    }

    const counterSnap = await tx.get(counterRef);
    const year = new Date().getFullYear();
    const current = counterSnap.exists
      ? (counterSnap.data() as { year: number; seq: number })
      : null;
    const seq = nextSequence(current, year);

    const allocation = {
      itemId: input.itemId,
      beneficiaryId: input.beneficiaryId,
      allocatedAt: new Date().toISOString(),
      allocatedBy: input.allocatedBy,
      expectedReturnAt: input.expectedReturnAt,
      actualReturnedAt: null,
      checkedInBy: null,
      conditionOnReturn: null,
      status: "ACTIVE" as const,
      notes: input.notes,
      receiptNumber: formatReceiptNumber(year, seq),
    };

    tx.set(counterRef, { year, seq });
    tx.set(allocRef, allocation);
    tx.update(itemRef, { status: "ALLOCATED", currentAllocationId: allocRef.id });

    return allocation;
  });

  return { id: allocRef.id, ...record };
}

export interface ReturnAllocationInput {
  allocationId: string;
  actualReturnedAt: string;
  conditionOnReturn: Condition;
  checkedInBy: string;
}

/** The allocation update and the item's condition-derived status commit together. */
export async function returnAllocation(
  input: ReturnAllocationInput
): Promise<Allocation | null> {
  const allocRef = allocations().doc(input.allocationId);

  return adminDb.runTransaction(async (tx) => {
    const allocSnap = await tx.get(allocRef);
    if (!allocSnap.exists) return null;

    const existing = toAllocation(allocSnap.id, allocSnap.data()!);
    const itemRef = adminDb.collection("items").doc(existing.itemId);
    const itemSnap = await tx.get(itemRef);

    const patch = {
      actualReturnedAt: input.actualReturnedAt,
      checkedInBy: input.checkedInBy,
      conditionOnReturn: input.conditionOnReturn,
      status: "RETURNED" as const,
    };

    tx.update(allocRef, patch);

    if (itemSnap.exists) {
      tx.update(itemRef, {
        status: statusForCondition(input.conditionOnReturn),
        condition: input.conditionOnReturn,
        currentAllocationId: null,
      });
    }

    return { ...existing, ...patch };
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/allocations.ts
git commit -m "feat: add transactional allocations repository"
```

---

### Task 8: Users repository

**Files:**
- Create: `lib/repositories/users.ts`

**Interfaces:**
- Consumes: `adminDb`, `adminAuth`; `UserProfile`, `UserRole` from `@/lib/types`
- Produces: `listUsers(): Promise<UserProfile[]>`, `getUserProfile(uid): Promise<UserProfile | null>`, `createUser(input): Promise<{ profile: UserProfile; password: string }>`, `setUserDisabled(uid, disabled): Promise<void>`, `recordLogin(uid): Promise<void>`

- [ ] **Step 1: Create the users repository**

Create `lib/repositories/users.ts`:

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/users.ts
git commit -m "feat: add users repository with role claims"
```

---

### Task 9: Split server actions and enforce authorization

**Files:**
- Create: `app/actions/items.ts`, `app/actions/allocations.ts`, `app/actions/users.ts`, `app/actions/session.ts`
- Delete: `app/actions.ts`
- Modify: `app/page.tsx`, `app/allocations/page.tsx`, `app/inventory/page.tsx`, `app/add-item/page.tsx`, `app/receipt/[id]/page.tsx`, `components/checkout-cart.tsx` (import paths)

**Interfaces:**
- Consumes: every repository from Tasks 6–8; `requireUser`, `requireAdmin` from `@/lib/auth/session`; `messageForAuthError` from `@/lib/auth/errors`
- Produces:
  - `app/actions/items.ts`: `getItemsAction()`, `createItemAction(data)`, `updateItemAction(id, updates)`, `deleteItemAction(id)`
  - `app/actions/allocations.ts`: `getAllocationsAction()`, `getBeneficiariesAction()`, `createAllocationAction(data)`, `returnAllocationAction(data)`
  - `app/actions/users.ts`: `getUsersAction()`, `createUserAction(data)`, `setUserDisabledAction(uid, disabled)`
  - `app/actions/session.ts`: `getCurrentUserAction(): Promise<SessionUser | null>`

Every action verifies the session server-side. Hiding a navigation item is not access control.

- [ ] **Step 1: Create the items actions**

Create `app/actions/items.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { messageForAuthError } from "@/lib/auth/errors";
import * as itemsRepo from "@/lib/repositories/items";
import type { Condition, Item } from "@/lib/types";

export async function getItemsAction(): Promise<Item[]> {
  try {
    await requireUser();
    return await itemsRepo.listItems();
  } catch (error) {
    console.error("getItemsAction failed:", error);
    return [];
  }
}

export async function createItemAction(data: {
  assetTag: string;
  name: string;
  category: string;
  condition: Condition;
  registeredAt: string;
}): Promise<{ success: boolean; item?: Item; error?: string }> {
  try {
    const user = await requireAdmin();

    if (await itemsRepo.assetTagExists(data.assetTag)) {
      return { success: false, error: `Asset tag ${data.assetTag} already exists.` };
    }

    const item = await itemsRepo.createItem({ ...data, registeredBy: user.uid });
    revalidatePath("/");
    revalidatePath("/inventory");
    return { success: true, item };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("createItemAction failed:", error);
    return { success: false, error: "Could not register the device." };
  }
}

export async function updateItemAction(
  id: string,
  updates: Partial<Pick<Item, "assetTag" | "name" | "category" | "condition" | "status">>
): Promise<{ success: boolean; item?: Item | null; error?: string }> {
  try {
    await requireAdmin();
    const item = await itemsRepo.updateItem(id, updates);
    revalidatePath("/");
    revalidatePath("/inventory");
    return { success: true, item };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("updateItemAction failed:", error);
    return { success: false, error: "Could not update the device." };
  }
}

export async function deleteItemAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const success = await itemsRepo.deleteItem(id);
    revalidatePath("/");
    revalidatePath("/inventory");
    return { success };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("deleteItemAction failed:", error);
    return { success: false, error: "Could not delete the device." };
  }
}
```

- [ ] **Step 2: Create the allocations actions**

Create `app/actions/allocations.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { messageForAuthError } from "@/lib/auth/errors";
import * as allocationsRepo from "@/lib/repositories/allocations";
import { ItemUnavailableError } from "@/lib/repositories/allocations";
import * as beneficiariesRepo from "@/lib/repositories/beneficiaries";
import type { Allocation, AllocationWithRefs, Beneficiary, Condition } from "@/lib/types";

export async function getAllocationsAction(): Promise<AllocationWithRefs[]> {
  try {
    await requireUser();
    return await allocationsRepo.listAllocations();
  } catch (error) {
    console.error("getAllocationsAction failed:", error);
    return [];
  }
}

export async function getBeneficiariesAction(): Promise<Beneficiary[]> {
  try {
    await requireUser();
    return await beneficiariesRepo.listBeneficiaries();
  } catch (error) {
    console.error("getBeneficiariesAction failed:", error);
    return [];
  }
}

export async function createAllocationAction(data: {
  itemId: string;
  beneficiary: { id?: string; name: string; phone: string; address: string };
  expectedReturnAt: string;
  notes: string;
}): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
  try {
    const user = await requireUser();

    const beneficiary = data.beneficiary.id
      ? await beneficiariesRepo.getBeneficiary(data.beneficiary.id)
      : await beneficiariesRepo.findOrCreateBeneficiary(
          {
            name: data.beneficiary.name,
            phone: data.beneficiary.phone,
            address: data.beneficiary.address,
          },
          user.uid
        );

    if (!beneficiary) return { success: false, error: "Beneficiary not found." };

    const allocation = await allocationsRepo.createAllocation({
      itemId: data.itemId,
      beneficiaryId: beneficiary.id,
      expectedReturnAt: new Date(data.expectedReturnAt).toISOString(),
      notes: data.notes,
      allocatedBy: user.uid,
    });

    revalidatePath("/");
    revalidatePath("/allocations");
    return { success: true, allocation };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    if (error instanceof ItemUnavailableError) {
      return { success: false, error: error.message };
    }
    console.error("createAllocationAction failed:", error);
    return { success: false, error: "Could not give out the equipment." };
  }
}

export async function returnAllocationAction(data: {
  allocationId: string;
  conditionOnReturn: Condition;
  actualReturnedAt: string;
}): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
  try {
    const user = await requireUser();

    const allocation = await allocationsRepo.returnAllocation({
      allocationId: data.allocationId,
      actualReturnedAt: new Date(data.actualReturnedAt).toISOString(),
      conditionOnReturn: data.conditionOnReturn,
      checkedInBy: user.uid,
    });

    if (!allocation) return { success: false, error: "Allocation not found." };

    revalidatePath("/");
    revalidatePath("/allocations");
    return { success: true, allocation };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("returnAllocationAction failed:", error);
    return { success: false, error: "Could not record the return." };
  }
}
```

- [ ] **Step 3: Create the users actions**

Create `app/actions/users.ts`:

```ts
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
```

- [ ] **Step 4: Create the session action**

Create `app/actions/session.ts`:

```ts
"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getUserProfile } from "@/lib/repositories/users";
import type { SessionUser } from "@/lib/types";

export async function getCurrentUserAction(): Promise<
  (SessionUser & { name: string }) | null
> {
  const session = await getSessionUser();
  if (!session) return null;

  const profile = await getUserProfile(session.uid);
  return { ...session, name: profile?.name ?? session.email };
}
```

- [ ] **Step 5: Delete the old actions file and repoint imports**

```bash
git rm app/actions.ts
```

Update the import in each consuming file:

- `app/page.tsx`: `import { getItemsAction } from "@/app/actions/items";` and `import { getAllocationsAction, getBeneficiariesAction } from "@/app/actions/allocations";`
- `app/allocations/page.tsx`: `import { getAllocationsAction, returnAllocationAction } from "@/app/actions/allocations";`
- `app/inventory/page.tsx`: `import { getItemsAction, updateItemAction, deleteItemAction } from "@/app/actions/items";`
- `app/add-item/page.tsx`: `import { createItemAction } from "@/app/actions/items";`
- `app/receipt/[id]/page.tsx`: `import { getAllocationsAction } from "@/app/actions/allocations";`
- `components/checkout-cart.tsx`: `import { createAllocationAction } from "@/app/actions/allocations";` — and remove the now-deleted `createBeneficiaryAction` import, since beneficiary creation happens inside `createAllocationAction`.

- [ ] **Step 6: Update the call sites the new shapes changed**

In `components/checkout-cart.tsx`, replace the two-step "create beneficiary, then loop allocations" logic in `handleCheckout` with a single call per item that passes the beneficiary inline:

```ts
const beneficiaryPayload =
  beneficiaryMode === "existing"
    ? { id: selectedBeneficiaryId, name: "", phone: "", address: "" }
    : {
        name: newBenName.trim(),
        phone: newBenPhone.trim(),
        address: newBenAddress.trim(),
      };

const allocationIds: string[] = [];
for (const item of cartItems) {
  const result = await createAllocationAction({
    itemId: item.id,
    beneficiary: beneficiaryPayload,
    expectedReturnAt: new Date(expectedReturnDate).toISOString(),
    notes: notes.trim(),
  });
  if (!result.success || !result.allocation) {
    throw new Error(result.error || `Could not give out ${item.name}`);
  }
  allocationIds.push(result.allocation.id);
}
```

Also remove the `newBenVolunteer` state, its input field, and its validation — `volunteerInCharge` no longer exists. The `onRefreshBeneficiaries` prop on `CheckoutCartProps` has no remaining caller once beneficiary creation is folded into `createAllocationAction` — remove the prop, its type entry, and the corresponding `onRefreshBeneficiaries={loadData}` passed from `app/page.tsx`.

In `app/allocations/page.tsx`, the check-in call becomes:

```ts
const result = await returnAllocationAction({
  allocationId: alloc.id,
  conditionOnReturn: conditionOnReturn,
  actualReturnedAt: new Date().toISOString(),
});
```

Rename the local `conditionOnCheckIn` state to `conditionOnReturn`. The editable return-date field arrives in Phase 4; for now it sends the current time.

In `app/inventory/page.tsx` and `app/add-item/page.tsx`, rename every reference to `conditionOnCheckIn` to `condition`. `app/add-item/page.tsx` must additionally send `registeredAt: new Date().toISOString()` in its `createItemAction` call.

- [ ] **Step 7: Verify the whole project typechecks**

Run: `npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 8: Commit**

```bash
git add app/actions app/page.tsx app/allocations/page.tsx app/inventory/page.tsx app/add-item/page.tsx "app/receipt/[id]/page.tsx" components/checkout-cart.tsx
git commit -m "refactor: split actions by entity and enforce authorization"
```

---

### Task 10: Login page, logout and middleware

**Files:**
- Create: `app/login/page.tsx`
- Create: `middleware.ts`
- Create: `components/sign-out-button.tsx`

**Interfaces:**
- Consumes: `clientAuth` from `@/lib/firebase/client`; `SESSION_COOKIE` from `@/lib/auth/session`
- Produces: `SignOutButton` component

- [ ] **Step 1: Create the login page**

Create `app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email.trim(), password);
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not sign in.");
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      // Firebase error codes are not useful to a volunteer.
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setError("That email or password is not correct.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else if (code === "auth/network-request-failed") {
        setError("No internet connection. Please check and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not sign in.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="space-y-3 text-center">
          <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full border border-primary/20">
            <Image src="/logo.png" alt="QIDMA" fill sizes="64px" priority className="object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-primary">
              QIDMA Medical Aid
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              By KMCC Qatar Vanimal Panchayat
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-bold text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-bold text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center space-x-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          <span>{busy ? "Signing in..." : "Sign In"}</span>
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Accounts are created by an administrator.
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create the sign-out button**

Create `components/sign-out-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut(clientAuth).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
```

- [ ] **Step 3: Create the middleware**

Create `middleware.ts` at the repository root:

```ts
import { NextResponse, type NextRequest } from "next/server";

// Middleware runs on the Edge runtime, where firebase-admin cannot run. It
// therefore checks only that a session cookie is PRESENT — it cannot verify
// it. Real authorization happens in every server action. This exists purely so
// signed-out visitors land on the login page instead of an empty dashboard.
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("qidma_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|logo.png|manifest.json|sw.js).*)"],
};
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds. It will fail at this point only if Firebase env vars are missing — fill in `.env.local` first.

- [ ] **Step 5: Commit**

```bash
git add app/login middleware.ts components/sign-out-button.tsx
git commit -m "feat: add login page, sign out and session middleware"
```

---

### Task 11: Role-based navigation and admin hub

**Files:**
- Modify: `app/layout.tsx`
- Rewrite: `components/bottom-nav.tsx`
- Create: `components/nav-context.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUserAction` from `@/app/actions/session`; `getUsersAction`, `createUserAction`, `setUserDisabledAction` from `@/app/actions/users`; `SignOutButton`
- Produces: `useCurrentUser()` hook from `@/components/nav-context`; `CurrentUserProvider` component

A volunteer sees two destinations. An administrator sees those two plus an Admin hub. Depth instead of width keeps the everyday screens uncluttered.

- [ ] **Step 1: Create the current-user context**

Create `components/nav-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUserAction } from "@/app/actions/session";
import type { SessionUser } from "@/lib/types";

type CurrentUser = (SessionUser & { name: string }) | null;

const CurrentUserContext = createContext<{ user: CurrentUser; loading: boolean }>({
  user: null,
  loading: true,
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUserAction()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return (
    <CurrentUserContext.Provider value={{ user, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
```

- [ ] **Step 2: Rewrite the bottom navigation**

Replace the contents of `components/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HandHeart, PackageCheck, ShieldCheck } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  if (!user || pathname === "/login") return null;

  const navItems = [
    { label: "Give Out", href: "/", icon: HandHeart },
    { label: "Returns", href: "/allocations", icon: PackageCheck },
    ...(user.role === "admin"
      ? [{ label: "Admin", href: "/admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-card/90 px-6 py-2 shadow-lg backdrop-blur-md md:hidden">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all duration-200 active:scale-95 ${
                isActive
                  ? "border border-teal-100/50 bg-teal-50 font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="mt-0.5 text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Update the layout**

In `app/layout.tsx`: wrap `<body>`'s contents in `<CurrentUserProvider>`, replace the four desktop nav links with the same role-aware set (Give Out, Returns, and Admin for administrators), add `<SignOutButton />` beside the "Kerala Chapter" badge, and apply the QIDMA branding strings:

```tsx
<h1 className="text-base font-bold tracking-tight text-primary md:text-lg">
  QIDMA Medical Aid
</h1>
<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
  By KMCC Qatar Vanimal Panchayat
</p>
```

Update `metadata` to:

```ts
export const metadata: Metadata = {
  title: "QIDMA Medical Aid",
  description: "Medical equipment lending and inventory — By KMCC Qatar Vanimal Panchayat",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "QIDMA" },
};
```

- [ ] **Step 4: Create the admin hub**

Create `app/admin/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Boxes, PlusCircle, Users, ScrollText } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

const cards = [
  { href: "/inventory", icon: Boxes, title: "Devices", body: "View and update every registered device." },
  { href: "/add-item", icon: PlusCircle, title: "Register a Device", body: "Add newly purchased or donated equipment." },
  { href: "/admin/users", icon: Users, title: "Volunteers", body: "Create accounts and control who has access." },
  { href: "/admin/activity", icon: ScrollText, title: "Activity Log", body: "See who did what, and when." },
];

export default function AdminHub() {
  const { user, loading } = useCurrentUser();

  if (loading) return null;
  if (user?.role !== "admin") {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This area is for administrators.
      </p>
    );
  }

  return (
    <div className="animate-page space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">Admin</h2>
        <p className="text-xs text-muted-foreground">Manage devices, volunteers and records.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="flex items-start space-x-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-teal-300 hover:shadow-md active:scale-[0.99]"
            >
              <span className="rounded-xl border border-teal-100 bg-teal-50 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base font-bold text-foreground">{card.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{card.body}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

The Activity Log screen it links to arrives in Phase 4. Create `app/admin/activity/page.tsx` now as a placeholder that renders the heading "Activity Log" and the sentence "Recording of user activity begins in the next release." so the link does not 404.

- [ ] **Step 5: Create the volunteers screen**

Create `app/admin/users/page.tsx` with: a list of users from `getUsersAction()` showing name, email, mobile, role and disabled state; a "Add volunteer" form calling `createUserAction`; and an enable/disable toggle calling `setUserDisabledAction`. On successful creation, show the returned `password` in a highlighted panel with the text "Share this password with the volunteer. It will not be shown again." and a WhatsApp share link built as:

```ts
const shareUrl = `https://wa.me/${mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
  `QIDMA Medical Aid sign-in\nEmail: ${email}\nPassword: ${password}\n\nPlease change your password after signing in.`
)}`;
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx components/bottom-nav.tsx components/nav-context.tsx app/admin
git commit -m "feat: add role-based navigation and admin hub"
```

---

### Task 12: Bootstrap script and Firestore rules

**Files:**
- Create: `scripts/bootstrap-admin.ts`
- Create: `firestore.rules`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createUser` from `@/lib/repositories/users`
- Produces: `npm run bootstrap:admin`

An administrator creates every account, so the first administrator cannot be created through the interface. Without this script there is no way into the deployed application.

- [ ] **Step 1: Create the bootstrap script**

Create `scripts/bootstrap-admin.ts`:

```ts
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
```

- [ ] **Step 2: Install dotenv and add the script**

```bash
npm install --save-dev dotenv
```

Add to `package.json` scripts:

```json
"bootstrap:admin": "tsx scripts/bootstrap-admin.ts"
```

- [ ] **Step 3: Create the Firestore rules**

Create `firestore.rules`:

```
rules_version = '2';

// QIDMA reaches Firestore only through the Admin SDK on the server, which
// bypasses these rules entirely. No client ever reads or writes Firestore
// directly, so denying everything here is the correct and complete policy.
// Deploy with: firebase deploy --only firestore:rules
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Run the bootstrap script**

Run: `npm run bootstrap:admin`
Expected: prints "Created administrator <email>". Requires `.env.local` to be filled in with real Firebase credentials.

- [ ] **Step 5: Commit**

```bash
git add scripts/bootstrap-admin.ts firestore.rules package.json package-lock.json
git commit -m "feat: add first-admin bootstrap script and firestore rules"
```

---

### Task 13: Rebrand, remove the JSON layer, verify

**Files:**
- Delete: `lib/db-service.ts`, `data/db.json`
- Modify: `public/manifest.json`, `README.md`, `CLAUDE.md`, `public/sw.js`
- Modify: `app/receipt/[id]/page.tsx`

- [ ] **Step 1: Delete the JSON data layer**

```bash
git rm lib/db-service.ts data/db.json
rmdir data 2>/dev/null || true
```

Nothing should still import `lib/db-service`. Confirm with:

Run: `grep -rn "db-service" app components lib scripts`
Expected: no matches.

- [ ] **Step 2: Rebrand the manifest**

In `public/manifest.json`, set:

```json
"name": "QIDMA Medical Aid",
"short_name": "QIDMA",
"description": "Medical equipment lending and inventory — By KMCC Qatar Vanimal Panchayat",
```

- [ ] **Step 3: Rebrand the receipt**

In `app/receipt/[id]/page.tsx`, replace the heading text `KMCC CHARITY MEDICAL HELP WING` with `QIDMA MEDICAL AID` and add the tagline line `By KMCC Qatar Vanimal Panchayat` beneath it, in both the printed markup and the WhatsApp message body. Replace the `Volunteer In-charge` value, which previously read `beneficiary.volunteerInCharge`, with `allocations[0].allocatedByName ?? "—"`.

- [ ] **Step 4: Bump the service worker cache**

In `public/sw.js`, change `CACHE_NAME` to `"qidma-cache-v1"` so returning users do not keep the old branded shell.

- [ ] **Step 5: Update the documentation**

Rewrite the project name and stack sections of `README.md` for QIDMA and Firebase, replacing the "Serverless Compatibility (Vercel Optimization)" section entirely — the `/tmp` JSON behaviour it documents no longer exists. Add setup steps: copy `.env.example` to `.env.local`, fill it in, run `npm run bootstrap:admin`, then `npm run dev`.

In `CLAUDE.md`, replace the "Data flow", "The database" and "Domain rules that live in code, not data" sections to describe Firestore, the session-cookie auth flow, the repository layer, and the fact that authorization is enforced in server actions rather than middleware. Remove the note about `data/db.json` dirtying the working tree, which no longer applies.

- [ ] **Step 6: Run every check**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tests pass (16 tests), no type errors, no lint errors, build succeeds.

- [ ] **Step 7: Verify manually**

Run `npm run dev`, then confirm each of these:

1. Visiting `/` while signed out redirects to `/login`.
2. Signing in as the bootstrap administrator lands on Give Out.
3. The bottom navigation shows three items for an administrator.
4. Creating a volunteer from `/admin/users` returns a password and a working WhatsApp link.
5. Signing in as that volunteer shows only two navigation items, and visiting `/admin/users` directly returns no user data.
6. Registering a device with condition "Needs Repair" gives it MAINTENANCE status, not AVAILABLE.
7. Giving out a device produces a receipt numbered `QID-<year>-0001` and flips the device to ALLOCATED.
8. Recording a return sets the device back to AVAILABLE and names the volunteer who checked it in.
9. Signing out returns to `/login`, and the back button does not restore the dashboard.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rebrand to QIDMA Medical Aid and remove JSON data layer"
```

---

## Phase 1 Done

At this point the application runs on Firestore behind Firebase Auth, with administrator-created accounts, role-separated navigation, and QIDMA branding. Phases 2–4 (device acquisition details, contributions, activity log, editable return dates, interface polish) each get their own plan.
