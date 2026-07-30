# QIDMA Phase 3 — Giving Out: Available Filter & Contributions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining Phase 3 items from the approved spec's build order: the Give Out screen defaults to showing only available equipment, and a volunteer can record a beneficiary's optional cash/UPI/bank-transfer contribution at checkout — recorded atomically with the allocation it belongs to, never as a separate, droppable write.

**Architecture:** `Contribution` is a new Firestore collection (`contributions/{id}`), written inside the *same* `adminDb.runTransaction()` call that `createAllocation()` already uses — money collected and the lending record it belongs to either both persist or neither does. A pure `validateContribution()` function (mirroring Phase 2's `validateAcquisition()`) turns untrusted client input into a typed record or a rejection, server-side. The cart holds one beneficiary per checkout but N items/allocations; the contribution is recorded once, attached to the first allocation created, not once per item.

**Tech Stack:** Same as Phases 1–2 — Next.js 14 App Router, Firebase Admin SDK, Firestore, Tailwind, Vitest.

## Global Constraints

- All monetary amounts are INR. No currency field is stored.
- `lib/types.ts` continues to import nothing.
- Any module touching `firebase-admin` must start with `import "server-only";`.
- A contribution is always optional — most handouts involve no money. Never require it to complete a checkout.
- Do not touch check-in/return contributions, the activity log, or the editable return date — those are Phase 4.

---

### Task 1: Contribution domain type and validation

**Files:**
- Create: `lib/domain/contribution.ts`
- Test: `lib/domain/contribution.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type ContributionMethod = "cash" | "upi" | "bank_transfer"`, `type ContributionInput`, `validateContribution(input: unknown): { valid: true; contribution: ContributionInput } | { valid: false; error: string }`

- [ ] **Step 1: Write the failing test**

Create `lib/domain/contribution.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateContribution } from "./contribution";

describe("validateContribution", () => {
  it("accepts a complete cash contribution", () => {
    const result = validateContribution({ amount: 500, method: "cash", reference: "" });
    expect(result.valid).toBe(true);
  });

  it("accepts a UPI contribution with a reference", () => {
    const result = validateContribution({ amount: 1200, method: "upi", reference: "UPI/2026/8842" });
    expect(result.valid).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = validateContribution({ amount: 0, method: "cash", reference: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = validateContribution({ amount: -100, method: "cash", reference: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects an unrecognized method", () => {
    const result = validateContribution({ amount: 500, method: "cheque", reference: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object input", () => {
    const result = validateContribution(undefined);
    expect(result.valid).toBe(false);
  });

  it("defaults a missing reference to an empty string", () => {
    const result = validateContribution({ amount: 500, method: "cash" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.contribution.reference).toBe("");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/domain/contribution.test.ts`
Expected: FAIL — cannot find module `./contribution`.

- [ ] **Step 3: Implement the type and validator**

Create `lib/domain/contribution.ts`:

```ts
export type ContributionMethod = "cash" | "upi" | "bank_transfer";
export type ContributionStage = "checkout" | "checkin";

export interface ContributionInput {
  amount: number;
  method: ContributionMethod;
  reference: string;
}

export type ContributionValidation =
  | { valid: true; contribution: ContributionInput }
  | { valid: false; error: string };

const METHODS: ContributionMethod[] = ["cash", "upi", "bank_transfer"];

/**
 * A contribution is always optional — most handouts involve no money — so
 * this only runs when a volunteer has actually entered an amount. The server
 * must not trust that the client enforced a positive amount or a known
 * payment method.
 */
export function validateContribution(input: unknown): ContributionValidation {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Contribution details are required." };
  }

  const data = input as Record<string, unknown>;
  const amount = typeof data.amount === "number" ? data.amount : NaN;
  const method = data.method as ContributionMethod;
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: "Contribution amount must be a positive number." };
  }
  if (!METHODS.includes(method)) {
    return { valid: false, error: "Contribution method must be cash, UPI, or bank transfer." };
  }

  return { valid: true, contribution: { amount, method, reference } };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/domain/contribution.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/contribution.ts lib/domain/contribution.test.ts
git commit -m "feat: add contribution type and validation rule"
```

---

### Task 2: Contribution type and repository

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/repositories/contributions.ts`

**Interfaces:**
- Consumes: `ContributionMethod`, `ContributionStage`, `ContributionInput` from `@/lib/domain/contribution`
- Produces: `Contribution` type from `@/lib/types`; `newContributionRef(): FirebaseFirestore.DocumentReference`, `buildContributionRecord(input): Record<string, unknown>`, `listContributionsForAllocations(allocationIds: string[]): Promise<Contribution[]>` from `@/lib/repositories/contributions`

The write path is split deliberately: `newContributionRef` and `buildContributionRecord` are used *inside* the allocation transaction in Task 3 (a transaction's writes must all go through the same `tx` object, so this repository cannot call `.set()` itself for the checkout path). `listContributionsForAllocations` is a normal read, used by the receipt page.

- [ ] **Step 1: Add the `Contribution` type**

In `lib/types.ts`, add the import and re-export near the existing domain re-exports:

```ts
import type { ContributionInput, ContributionMethod, ContributionStage } from "@/lib/domain/contribution";

export type { ContributionInput, ContributionMethod, ContributionStage };
```

Add a new interface (anywhere after `Allocation`):

```ts
export interface Contribution {
  id: string;
  beneficiaryId: string;
  allocationId: string;
  stage: ContributionStage;
  amount: number;
  method: ContributionMethod;
  reference: string;
  collectedBy: string;
  collectedAt: string;
}
```

- [ ] **Step 2: Create the contributions repository**

Create `lib/repositories/contributions.ts`:

```ts
import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Contribution, ContributionInput, ContributionStage } from "@/lib/types";

const contributions = () => adminDb.collection("contributions");

function toContribution(id: string, data: FirebaseFirestore.DocumentData): Contribution {
  return {
    id,
    beneficiaryId: data.beneficiaryId,
    allocationId: data.allocationId,
    stage: data.stage,
    amount: data.amount,
    method: data.method,
    reference: data.reference ?? "",
    collectedBy: data.collectedBy,
    collectedAt: data.collectedAt,
  };
}

/** A fresh, unwritten document reference — the caller writes it inside their own transaction. */
export function newContributionRef(): FirebaseFirestore.DocumentReference {
  return contributions().doc();
}

export interface BuildContributionRecordInput extends ContributionInput {
  beneficiaryId: string;
  allocationId: string;
  stage: ContributionStage;
  collectedBy: string;
}

export function buildContributionRecord(input: BuildContributionRecordInput) {
  return {
    beneficiaryId: input.beneficiaryId,
    allocationId: input.allocationId,
    stage: input.stage,
    amount: input.amount,
    method: input.method,
    reference: input.reference,
    collectedBy: input.collectedBy,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * Firestore has no "IN this large list" query beyond 30 values, but a single
 * receipt covers one checkout's worth of items — well under that limit — so
 * a single `in` query is sufficient here.
 */
export async function listContributionsForAllocations(
  allocationIds: string[]
): Promise<Contribution[]> {
  if (allocationIds.length === 0) return [];

  const snapshot = await contributions().where("allocationId", "in", allocationIds).get();
  return snapshot.docs.map((doc) => toContribution(doc.id, doc.data()));
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/repositories/contributions.ts
git commit -m "feat: add contribution type and repository"
```

---

### Task 3: Write the contribution inside the allocation transaction

**Files:**
- Modify: `lib/repositories/allocations.ts`

**Interfaces:**
- Consumes: `newContributionRef`, `buildContributionRecord` from `@/lib/repositories/contributions`; `ContributionInput` from `@/lib/types`
- Produces: `CreateAllocationInput.contribution?: ContributionInput` (extends the existing interface)

- [ ] **Step 1: Import the contribution helpers**

In `lib/repositories/allocations.ts`, add to the imports:

```ts
import { newContributionRef, buildContributionRecord } from "@/lib/repositories/contributions";
import type {
  Allocation,
  AllocationWithRefs,
  Condition,
  ContributionInput,
  Item,
  Beneficiary,
} from "@/lib/types";
```

(This replaces the existing `import type { Allocation, AllocationWithRefs, Condition, Item, Beneficiary } from "@/lib/types";` line — add `ContributionInput` to it.)

- [ ] **Step 2: Extend `CreateAllocationInput` and write the contribution in the transaction**

Change `CreateAllocationInput` and the body of `createAllocation`:

```ts
export interface CreateAllocationInput {
  itemId: string;
  beneficiaryId: string;
  expectedReturnAt: string;
  notes: string;
  allocatedBy: string;
  contribution?: ContributionInput;
}

export async function createAllocation(
  input: CreateAllocationInput
): Promise<Allocation> {
  const itemRef = adminDb.collection("items").doc(input.itemId);
  const counterRef = adminDb.collection("counters").doc("receipts");
  const allocRef = allocations().doc();
  const contributionRef = input.contribution ? newContributionRef() : null;

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

    if (contributionRef && input.contribution) {
      tx.set(
        contributionRef,
        buildContributionRecord({
          ...input.contribution,
          beneficiaryId: input.beneficiaryId,
          allocationId: allocRef.id,
          stage: "checkout",
          collectedBy: input.allocatedBy,
        })
      );
    }

    return allocation;
  });

  return { id: allocRef.id, ...record };
}
```

The contribution doc ref is created *before* the transaction (Firestore refs are just IDs, not reads) so `allocRef.id` is available to link it, and the actual write happens inside `tx` alongside the allocation and item update — one commit, or none.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/repositories/allocations.ts
git commit -m "feat: write checkout contributions inside the allocation transaction"
```

---

### Task 4: Wire the action layer

**Files:**
- Modify: `app/actions/allocations.ts`
- Create: `app/actions/contributions.ts`

**Interfaces:**
- Consumes: `validateContribution` from `@/lib/domain/contribution`; `listContributionsForAllocations` from `@/lib/repositories/contributions`
- Produces: `createAllocationAction` gains an optional `contribution: unknown` field; `getContributionsForAllocationsAction(allocationIds: string[]): Promise<Contribution[]>` from `@/app/actions/contributions`

- [ ] **Step 1: Validate and thread the contribution through `createAllocationAction`**

In `app/actions/allocations.ts`, add the imports:

```ts
import { validateContribution } from "@/lib/domain/contribution";
import type { ContributionInput } from "@/lib/types";
```

Change the `createAllocationAction` signature and body:

```ts
export async function createAllocationAction(data: {
  itemId: string;
  beneficiary: { id?: string; name: string; phone: string; address: string };
  expectedReturnAt: string;
  notes: string;
  contribution?: unknown;
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

    let contribution: ContributionInput | undefined;
    if (data.contribution) {
      const result = validateContribution(data.contribution);
      if (!result.valid) return { success: false, error: result.error };
      contribution = result.contribution;
    }

    const allocation = await allocationsRepo.createAllocation({
      itemId: data.itemId,
      beneficiaryId: beneficiary.id,
      expectedReturnAt: new Date(data.expectedReturnAt).toISOString(),
      notes: data.notes,
      allocatedBy: user.uid,
      contribution,
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
```

- [ ] **Step 2: Create the contributions read action**

Create `app/actions/contributions.ts`:

```ts
"use server";

import { requireUser } from "@/lib/auth/session";
import * as contributionsRepo from "@/lib/repositories/contributions";
import type { Contribution } from "@/lib/types";

export async function getContributionsForAllocationsAction(
  allocationIds: string[]
): Promise<Contribution[]> {
  try {
    await requireUser();
    if (allocationIds.length === 0) return [];
    return await contributionsRepo.listContributionsForAllocations(allocationIds);
  } catch (error) {
    console.error("getContributionsForAllocationsAction failed:", error);
    return [];
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/actions/allocations.ts app/actions/contributions.ts
git commit -m "feat: validate and thread contributions through the checkout action"
```

---

### Task 5: Available-only filter on Give Out

**Files:**
- Modify: `app/page.tsx`

The available-only filter defaults to **on** — a volunteer lending equipment has no reason to see retired or already-lent devices by default.

- [ ] **Step 1: Add filter state and apply it**

In `app/page.tsx`, add state near the existing search/category filter state:

```tsx
const [showAllStatuses, setShowAllStatuses] = useState(false);
```

Change the `filteredItems` computation to also filter by status unless the toggle is on:

```tsx
const filteredItems = items.filter((item) => {
  const matchesSearch =
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.assetTag.toLowerCase().includes(searchQuery.toLowerCase());
  const matchesCategory =
    selectedCategory === "All" ||
    item.category.toLowerCase() === selectedCategory.toLowerCase();
  const matchesAvailability = showAllStatuses || item.status === "AVAILABLE";
  return matchesSearch && matchesCategory && matchesAvailability;
});
```

- [ ] **Step 2: Add the toggle to the UI**

In the "POS Controls: Search & Category Buttons" section, immediately after the Category Pills `<div>` closes, add:

```tsx
{/* Availability Toggle */}
<label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
  <span className="font-semibold text-muted-foreground">
    {showAllStatuses ? "Showing all equipment" : "Showing available equipment only"}
  </span>
  <button
    type="button"
    onClick={() => setShowAllStatuses((v) => !v)}
    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
      showAllStatuses ? "bg-primary" : "bg-muted"
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        showAllStatuses ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
</label>
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc --noEmit && npx next lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: default Give Out to available-only equipment with a toggle"
```

---

### Task 6: Checkout contribution UI

**Files:**
- Modify: `components/checkout-cart.tsx`

The contribution box stays collapsed behind an "Add contribution" link — most handouts involve no money. It is attached only to the *first* allocation created in the loop, since the cart's items share one beneficiary and one checkout event; recording the same money against every item would over-count it.

- [ ] **Step 1: Add contribution state**

In `components/checkout-cart.tsx`, add near the existing `notes` state:

```tsx
const [showContribution, setShowContribution] = useState(false);
const [contributionAmount, setContributionAmount] = useState("");
const [contributionMethod, setContributionMethod] = useState<"cash" | "upi" | "bank_transfer">("cash");
const [contributionReference, setContributionReference] = useState("");
```

Add the import for the chevron/plus icons already partially imported — extend the existing lucide-react import line:

```tsx
import { X, Trash2, UserPlus, UserCheck, Calendar, FileText, Loader2, ChevronsRight, HeartHandshake, ChevronDown } from "lucide-react";
```

- [ ] **Step 2: Build the contribution payload and attach it to the first allocation only**

Replace the allocation loop in `handleCheckout`:

```tsx
const contributionPayload =
  showContribution && contributionAmount.trim()
    ? {
        amount: Number(contributionAmount),
        method: contributionMethod,
        reference: contributionReference.trim(),
      }
    : undefined;

const allocationIds: string[] = [];
for (const [index, item] of cartItems.entries()) {
  const allocRes = await createAllocationAction({
    itemId: item.id,
    beneficiary: beneficiaryPayload,
    expectedReturnAt: new Date(expectedReturnDate).toISOString(),
    notes: notes.trim(),
    contribution: index === 0 ? contributionPayload : undefined,
  });

  if (!allocRes.success || !allocRes.allocation) {
    throw new Error(allocRes.error || `Could not give out ${item.name}`);
  }
  allocationIds.push(allocRes.allocation.id);
}
```

- [ ] **Step 3: Reset contribution state on success**

In the success branch of `handleCheckout` (where `onClearCart()` / `onClose()` are called), add before them:

```tsx
setShowContribution(false);
setContributionAmount("");
setContributionMethod("cash");
setContributionReference("");
```

- [ ] **Step 4: Add the collapsed contribution UI**

In the JSX, insert this block after the "Return Date & Notes" section's closing `</div>` and before the scrollable body's closing `</div>`:

```tsx
{/* Beneficiary Contribution (optional, collapsed by default) */}
<div className="space-y-3">
  {!showContribution ? (
    <button
      type="button"
      onClick={() => setShowContribution(true)}
      className="flex items-center space-x-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
    >
      <HeartHandshake className="h-4 w-4" />
      <span>Add contribution (optional)</span>
    </button>
  ) : (
    <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <HeartHandshake className="h-3.5 w-3.5 text-teal-700" />
          <span>Beneficiary Contribution</span>
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowContribution(false);
            setContributionAmount("");
            setContributionReference("");
          }}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Remove
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-muted-foreground">Amount (INR)</label>
        <input
          type="number"
          min="1"
          step="0.01"
          value={contributionAmount}
          onChange={(e) => setContributionAmount(e.target.value)}
          placeholder="e.g. 500"
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-muted-foreground">Payment Method</label>
        <select
          value={contributionMethod}
          onChange={(e) => setContributionMethod(e.target.value as "cash" | "upi" | "bank_transfer")}
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-muted-foreground">Reference (optional)</label>
        <input
          type="text"
          value={contributionReference}
          onChange={(e) => setContributionReference(e.target.value)}
          placeholder="e.g. UPI transaction ID"
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc --noEmit && npx next lint`
Expected: PASS. If `ChevronDown` ends up unused (it is not referenced by the JSX above), remove it from the import list rather than leaving an unused import.

- [ ] **Step 6: Commit**

```bash
git add components/checkout-cart.tsx
git commit -m "feat: add collapsed beneficiary contribution form to checkout"
```

---

### Task 7: Show the contribution on the receipt

**Files:**
- Modify: `app/receipt/[id]/page.tsx`

**Interfaces:**
- Consumes: `getContributionsForAllocationsAction` from `@/app/actions/contributions`; `Contribution` from `@/lib/types`

- [ ] **Step 1: Fetch contributions alongside allocations**

In `app/receipt/[id]/page.tsx`, add the import and a new state:

```tsx
import { getContributionsForAllocationsAction } from "@/app/actions/contributions";
import type { AllocationWithRefs, Contribution } from "@/lib/types";
```

(This replaces the existing `import { AllocationWithRefs } from "@/lib/types";` line.)

Add state near `allocations`:

```tsx
const [contributions, setContributions] = useState<Contribution[]>([]);
```

In `fetchAllocations`, after `setAllocations(matched)` succeeds, fetch contributions for the matched ids:

```tsx
setAllocations(matched);
const fetchedContributions = await getContributionsForAllocationsAction(matched.map((a) => a.id));
setContributions(fetchedContributions);
```

- [ ] **Step 2: Compute a total and display it as an acknowledgement line**

After the existing `const volunteer = ...` line, add:

```tsx
const totalContribution = contributions.reduce((sum, c) => sum + c.amount, 0);
```

In the printable receipt, insert an acknowledgement block after the "ALLOCATIONS" section's closing `</div>` and before the next `<div className="my-4 border-b ...">` separator (i.e. right before the "Terms & Undertaking" section):

```tsx
{totalContribution > 0 && (
  <>
    <div className="my-3 border-b border-dashed border-black/80" />
    <div className="space-y-1 text-[10px]">
      <h3 className="font-black text-[12px] uppercase">CONTRIBUTION RECEIVED</h3>
      <p className="font-bold">
        ₹{totalContribution.toLocaleString("en-IN")} ({contributions[0].method.replace("_", " ")})
      </p>
      <p className="text-neutral-600">With thanks for supporting QIDMA Medical Aid.</p>
    </div>
  </>
)}
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc --noEmit && npx next lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/receipt/[id]/page.tsx"
git commit -m "feat: show beneficiary contribution as an acknowledgement on the receipt"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run every check**

```bash
npx vitest run
npx tsc --noEmit
npx next lint
npm run build
```

Expected: 33 tests pass (26 from Phases 1–2 + 7 new), no type errors, no lint errors. `npm run build` behaves as in prior phases — succeeds if Firebase credentials are present in `.env.local`, otherwise fails only at `Missing FIREBASE_PROJECT_ID`.

- [ ] **Step 2: Manual verification (requires a running dev server against a real Firebase project)**

1. On Give Out, confirm the toggle defaults to "Showing available equipment only" and a maintenance/retired/allocated item is hidden until toggled on.
2. Add an item to cart, open checkout, confirm no contribution UI is visible until "Add contribution (optional)" is clicked.
3. Complete a checkout with no contribution — confirm it succeeds and the receipt shows no "CONTRIBUTION RECEIVED" section.
4. Complete a checkout with a ₹500 cash contribution — confirm the receipt shows "₹500 (cash)" under CONTRIBUTION RECEIVED.
5. Add two items to the cart in one checkout with a contribution — confirm only one contribution record is created (check Firestore directly, or confirm the receipt total is not doubled).
6. Attempt a contribution with amount 0 or blank after opening the box, leave it blank, and submit — confirm checkout still succeeds with no contribution recorded (blank amount is treated as "no contribution", not an error).
