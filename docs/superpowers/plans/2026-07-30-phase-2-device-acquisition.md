# QIDMA Phase 2 — Device Acquisition Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record how each device was acquired — purchased or donated — with the fields the committee actually needs to track spending and donor contributions, using a progressive-disclosure form so a volunteer registering a device only ever sees the five fields relevant to the choice they made. Also close a UX gap from Phase 1: `/inventory` and `/add-item` are admin-only server-side but currently show their full UI to any signed-in volunteer before rejecting the submit.

**Architecture:** `Item.acquisition` is a discriminated union (`{ source: "purchase", ... } | { source: "donation", ... }`) stored as a single Firestore map field. The registration form asks "Purchased or Donated?" first via a two-button chooser; only after that choice does the relevant field set render. The repository and action layers validate the shape server-side — a client cannot submit a purchase without the fields a purchase requires.

**Tech Stack:** Same as Phase 1 — Next.js 14 App Router, Firebase Admin SDK, Firestore, Tailwind, Vitest.

## Global Constraints

- All monetary amounts are INR. No currency field is stored (per the approved spec — confirmed with the client 2026-07-30).
- `lib/types.ts` continues to import nothing.
- Any module touching `firebase-admin` must start with `import "server-only";`.
- Role values are exactly `admin` and `volunteer`; `/inventory` and `/add-item` are admin-only.
- Do not touch `app/actions/allocations.ts`, contributions, or the activity log — those are Phase 3/4.

---

### Task 1: Domain type and pure validation for acquisition

**Files:**
- Create: `lib/domain/acquisition.ts`
- Test: `lib/domain/acquisition.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Acquisition = PurchaseAcquisition | DonationAcquisition`, `type PurchaseAcquisition`, `type DonationAcquisition`, `validateAcquisition(input: unknown): { valid: true; acquisition: Acquisition } | { valid: false; error: string }`

Validation is a pure function so the "does this acquisition object make sense" rule is testable without Firestore, and reusable by both the server action and (later, if needed) any admin bulk-import tooling.

- [ ] **Step 1: Write the failing test**

Create `lib/domain/acquisition.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateAcquisition } from "./acquisition";

describe("validateAcquisition", () => {
  it("accepts a complete purchase record", () => {
    const result = validateAcquisition({
      source: "purchase",
      invoiceNumber: "INV-2026-001",
      supplier: "Kerala Medical Supplies",
      price: 12500,
      sourceOfFund: "General Fund",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a complete donation record", () => {
    const result = validateAcquisition({
      source: "donation",
      contributorName: "Anonymous Donor",
      estimatedValue: 8000,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a purchase missing the invoice number", () => {
    const result = validateAcquisition({
      source: "purchase",
      invoiceNumber: "",
      supplier: "Kerala Medical Supplies",
      price: 12500,
      sourceOfFund: "General Fund",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a purchase with a zero or negative price", () => {
    const result = validateAcquisition({
      source: "purchase",
      invoiceNumber: "INV-2026-001",
      supplier: "Kerala Medical Supplies",
      price: 0,
      sourceOfFund: "General Fund",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a donation missing the contributor name", () => {
    const result = validateAcquisition({
      source: "donation",
      contributorName: "  ",
      estimatedValue: 8000,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a donation with no estimated value given", () => {
    const result = validateAcquisition({
      source: "donation",
      contributorName: "Anonymous Donor",
      estimatedValue: null,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects an unrecognized source", () => {
    const result = validateAcquisition({ source: "gift" });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object input", () => {
    const result = validateAcquisition(null);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/domain/acquisition.test.ts`
Expected: FAIL — cannot find module `./acquisition`.

- [ ] **Step 3: Implement the type and validator**

Create `lib/domain/acquisition.ts`:

```ts
export interface PurchaseAcquisition {
  source: "purchase";
  invoiceNumber: string;
  supplier: string;
  price: number;
  sourceOfFund: string;
}

export interface DonationAcquisition {
  source: "donation";
  contributorName: string;
  /** Optional — a donor's estimate, not a receipt. */
  estimatedValue: number | null;
}

export type Acquisition = PurchaseAcquisition | DonationAcquisition;

export type AcquisitionValidation =
  | { valid: true; acquisition: Acquisition }
  | { valid: false; error: string };

/**
 * A device is registered as either purchased or donated, never both. This is
 * the single place that decides whether an acquisition record is complete —
 * the registration form only ever collects one branch, but the server must
 * not trust that the client enforced it.
 */
export function validateAcquisition(input: unknown): AcquisitionValidation {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Acquisition details are required." };
  }

  const data = input as Record<string, unknown>;

  if (data.source === "purchase") {
    const invoiceNumber = typeof data.invoiceNumber === "string" ? data.invoiceNumber.trim() : "";
    const supplier = typeof data.supplier === "string" ? data.supplier.trim() : "";
    const sourceOfFund = typeof data.sourceOfFund === "string" ? data.sourceOfFund.trim() : "";
    const price = typeof data.price === "number" ? data.price : NaN;

    if (!invoiceNumber) return { valid: false, error: "Invoice number is required for a purchase." };
    if (!supplier) return { valid: false, error: "Supplier is required for a purchase." };
    if (!sourceOfFund) return { valid: false, error: "Source of fund is required for a purchase." };
    if (!Number.isFinite(price) || price <= 0) {
      return { valid: false, error: "Price must be a positive amount." };
    }

    return {
      valid: true,
      acquisition: { source: "purchase", invoiceNumber, supplier, price, sourceOfFund },
    };
  }

  if (data.source === "donation") {
    const contributorName = typeof data.contributorName === "string" ? data.contributorName.trim() : "";
    const rawValue = data.estimatedValue;
    const estimatedValue =
      typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0 ? rawValue : null;

    if (!contributorName) {
      return { valid: false, error: "Contributor name is required for a donation." };
    }

    return { valid: true, acquisition: { source: "donation", contributorName, estimatedValue } };
  }

  return { valid: false, error: "Acquisition source must be 'purchase' or 'donation'." };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/domain/acquisition.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/acquisition.ts lib/domain/acquisition.test.ts
git commit -m "feat: add acquisition type and validation rule"
```

---

### Task 2: Extend Item type, repository and action with acquisition

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/repositories/items.ts`
- Modify: `app/actions/items.ts`

**Interfaces:**
- Consumes: `Acquisition`, `validateAcquisition` from `@/lib/domain/acquisition`
- Produces: `Item.acquisition: Acquisition`, `Item.registeredAt: string`, `CreateItemInput.acquisition: unknown` (validated inside `createItemAction`, not the repository)

- [ ] **Step 1: Add `acquisition` and `registeredAt` to the `Item` type**

In `lib/types.ts`, add the import and extend `Item`:

```ts
import type { Acquisition } from "@/lib/domain/acquisition";

export type { Acquisition };
```

Add two fields to the existing `Item` interface (do not remove any existing field):

```ts
export interface Item {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: ItemStatus;
  condition: Condition;
  currentAllocationId: string | null;
  registeredAt: string;
  acquisition: Acquisition;
}
```

- [ ] **Step 2: Thread the fields through the items repository**

In `lib/repositories/items.ts`, update `toItem` to read the two new fields, and update `CreateItemInput`/`createItem` to accept and store `acquisition`:

```ts
import type { Acquisition, Condition, Item } from "@/lib/types";

function toItem(id: string, data: FirebaseFirestore.DocumentData): Item {
  return {
    id,
    assetTag: data.assetTag,
    name: data.name,
    category: data.category,
    status: data.status,
    condition: data.condition,
    currentAllocationId: data.currentAllocationId ?? null,
    registeredAt: data.registeredAt,
    acquisition: data.acquisition,
  };
}
```

```ts
export interface CreateItemInput {
  assetTag: string;
  name: string;
  category: string;
  condition: Condition;
  registeredAt: string;
  registeredBy: string;
  acquisition: Acquisition;
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const ref = items().doc();
  const record = {
    assetTag: input.assetTag,
    assetTagLower: input.assetTag.toLowerCase(),
    name: input.name,
    category: input.category,
    condition: input.condition,
    status: statusForCondition(input.condition),
    currentAllocationId: null,
    registeredAt: input.registeredAt,
    registeredBy: input.registeredBy,
    acquisition: input.acquisition,
  };

  await ref.set(record);
  return toItem(ref.id, record);
}
```

`updateItem` is unchanged — acquisition details are recorded once at registration and are not part of the inventory edit form in this phase.

- [ ] **Step 3: Validate acquisition inside `createItemAction`**

In `app/actions/items.ts`, import the validator and validate before calling the repository:

```ts
import { validateAcquisition } from "@/lib/domain/acquisition";
```

Change the `createItemAction` signature and body:

```ts
export async function createItemAction(data: {
  assetTag: string;
  name: string;
  category: string;
  condition: Condition;
  registeredAt: string;
  acquisition: unknown;
}): Promise<{ success: boolean; item?: Item; error?: string }> {
  try {
    const user = await requireAdmin();

    if (await itemsRepo.assetTagExists(data.assetTag)) {
      return { success: false, error: `Asset tag ${data.assetTag} already exists.` };
    }

    const acquisitionResult = validateAcquisition(data.acquisition);
    if (!acquisitionResult.valid) {
      return { success: false, error: acquisitionResult.error };
    }

    const item = await itemsRepo.createItem({
      assetTag: data.assetTag,
      name: data.name,
      category: data.category,
      condition: data.condition,
      registeredAt: data.registeredAt,
      registeredBy: user.uid,
      acquisition: acquisitionResult.acquisition,
    });
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
```

`data.acquisition` is typed `unknown` on purpose — the client cannot be trusted to send a well-formed `Acquisition`, and `validateAcquisition` is exactly the function that turns untrusted input into a typed value or a rejection.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `app/add-item/page.tsx` (its `createItemAction` call is now missing the required `acquisition` field) and `app/inventory/page.tsx` (`Item` object literals used for state typing may now be missing `registeredAt`/`acquisition` — check whether any occur; if `editingItem` is only ever assigned from a fetched `Item`, there will be no error there). Task 3 fixes the add-item page.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/repositories/items.ts app/actions/items.ts
git commit -m "feat: add acquisition tracking to item type, repository and action"
```

---

### Task 3: Progressive-disclosure registration form

**Files:**
- Modify: `app/add-item/page.tsx`

**Interfaces:**
- Consumes: `createItemAction` from `@/app/actions/items` (now requires `acquisition`); `Acquisition` from `@/lib/types`

The form asks *Purchased or Donated* before showing any acquisition fields, so a volunteer registering a device sees five fields at a time, never nine.

- [ ] **Step 1: Add acquisition state and the source chooser**

In `app/add-item/page.tsx`, add state above `handleSubmit` (after the existing `condition` state):

```tsx
type AcquisitionSource = "purchase" | "donation" | null;

const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource>(null);
const [invoiceNumber, setInvoiceNumber] = useState("");
const [supplier, setSupplier] = useState("");
const [price, setPrice] = useState("");
const [sourceOfFund, setSourceOfFund] = useState("");
const [contributorName, setContributorName] = useState("");
const [estimatedValue, setEstimatedValue] = useState("");
```

- [ ] **Step 2: Build the acquisition payload and validate before submit**

Replace the body of `handleSubmit`'s validation and the `createItemAction` call:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!name.trim() || !assetTag.trim()) {
    setError("Please fill in all required fields.");
    return;
  }
  if (!acquisitionSource) {
    setError("Please choose whether this device was purchased or donated.");
    return;
  }

  setIsSubmitting(true);
  setError(null);
  setSuccess(false);

  const acquisition =
    acquisitionSource === "purchase"
      ? {
          source: "purchase" as const,
          invoiceNumber: invoiceNumber.trim(),
          supplier: supplier.trim(),
          price: Number(price),
          sourceOfFund: sourceOfFund.trim(),
        }
      : {
          source: "donation" as const,
          contributorName: contributorName.trim(),
          estimatedValue: estimatedValue.trim() ? Number(estimatedValue) : null,
        };

  try {
    const res = await createItemAction({
      name: name.trim(),
      category,
      assetTag: assetTag.trim().toUpperCase(),
      condition,
      registeredAt: new Date().toISOString(),
      acquisition,
    });

    if (!res.success) {
      throw new Error(res.error || "Failed to create item.");
    }

    setSuccess(true);
    setName("");
    setAssetTag("");
    setAcquisitionSource(null);
    setInvoiceNumber("");
    setSupplier("");
    setPrice("");
    setSourceOfFund("");
    setContributorName("");
    setEstimatedValue("");
    router.refresh();
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "An unexpected error occurred.");
  } finally {
    setIsSubmitting(false);
  }
};
```

- [ ] **Step 3: Add the source chooser and conditional field sets to the JSX**

Insert this block into the form, after the Condition field and before the Submit button:

```tsx
{/* Acquisition Source */}
<div className="space-y-2">
  <label className="text-xs font-bold text-muted-foreground">How was this device acquired?</label>
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={() => setAcquisitionSource("purchase")}
      className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
        acquisitionSource === "purchase"
          ? "border-primary bg-teal-50 text-primary shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-teal-300"
      }`}
    >
      Purchased
    </button>
    <button
      type="button"
      onClick={() => setAcquisitionSource("donation")}
      className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
        acquisitionSource === "donation"
          ? "border-primary bg-teal-50 text-primary shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-teal-300"
      }`}
    >
      Donated
    </button>
  </div>
</div>

{acquisitionSource === "purchase" && (
  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">Invoice Number</label>
      <input
        type="text"
        required
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
        placeholder="e.g. INV-2026-0142"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">Supplier</label>
      <input
        type="text"
        required
        value={supplier}
        onChange={(e) => setSupplier(e.target.value)}
        placeholder="e.g. Kerala Medical Supplies"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">Price (INR)</label>
      <input
        type="number"
        required
        min="1"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="e.g. 12500"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">Source of Fund</label>
      <input
        type="text"
        required
        value={sourceOfFund}
        onChange={(e) => setSourceOfFund(e.target.value)}
        placeholder="e.g. General Fund, Zakat Fund"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  </div>
)}

{acquisitionSource === "donation" && (
  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">Contributor Name</label>
      <input
        type="text"
        required
        value={contributorName}
        onChange={(e) => setContributorName(e.target.value)}
        placeholder="e.g. Anonymous Donor, or a name"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">Estimated Value (INR, optional)</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={estimatedValue}
        onChange={(e) => setEstimatedValue(e.target.value)}
        placeholder="e.g. 8000"
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `app/add-item/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/add-item/page.tsx
git commit -m "feat: add progressive-disclosure purchase/donation form to device registration"
```

---

### Task 4: Show acquisition details on the inventory card and edit modal

**Files:**
- Modify: `app/inventory/page.tsx`

Registration is one-time; the inventory screen is where an admin later checks what a device cost or who donated it, so the detail belongs on the card and in the read-only summary of the edit modal — not as editable fields, since acquisition history should not be casually rewritten after the fact.

- [ ] **Step 1: Add an acquisition summary line to each inventory card**

In the stock card's footer (near the existing "Condition: ..." line, inside the `<div className="mt-4 flex items-center justify-between border-t ...">` block), add a second line beneath it summarizing the source:

```tsx
<div className="mt-2 text-[11px] text-muted-foreground">
  {item.acquisition.source === "purchase" ? (
    <span>Purchased from {item.acquisition.supplier} · ₹{item.acquisition.price.toLocaleString("en-IN")}</span>
  ) : (
    <span>
      Donated by {item.acquisition.contributorName}
      {item.acquisition.estimatedValue ? ` · est. ₹${item.acquisition.estimatedValue.toLocaleString("en-IN")}` : ""}
    </span>
  )}
</div>
```

Place this as a new line directly after the existing condition/manage row `<div>` closes, still inside the card's outer `<div>`.

- [ ] **Step 2: Add a read-only acquisition summary to the edit modal**

In the edit modal, after the Condition field's helper paragraph and before "Actions: Save / Cancel", add:

```tsx
{/* Acquisition (read-only) */}
<div className="space-y-1 rounded-xl border border-border bg-muted/20 p-3">
  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
    Acquisition Record
  </label>
  {editingItem.acquisition.source === "purchase" ? (
    <div className="space-y-0.5 text-xs text-foreground">
      <p>Purchased · Invoice {editingItem.acquisition.invoiceNumber}</p>
      <p>Supplier: {editingItem.acquisition.supplier}</p>
      <p>Price: ₹{editingItem.acquisition.price.toLocaleString("en-IN")}</p>
      <p>Fund: {editingItem.acquisition.sourceOfFund}</p>
    </div>
  ) : (
    <div className="space-y-0.5 text-xs text-foreground">
      <p>Donated by {editingItem.acquisition.contributorName}</p>
      {editingItem.acquisition.estimatedValue && (
        <p>Estimated value: ₹{editingItem.acquisition.estimatedValue.toLocaleString("en-IN")}</p>
      )}
    </div>
  )}
  <p className="text-[10px] text-muted-foreground italic">
    Recorded at registration and not editable here.
  </p>
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/inventory/page.tsx
git commit -m "feat: show acquisition details on inventory cards and edit modal"
```

---

### Task 5: Gate `/inventory` and `/add-item` in the UI for non-admins

**Files:**
- Modify: `app/inventory/page.tsx`
- Modify: `app/add-item/page.tsx`

The server actions already reject a volunteer's `createItemAction`/`updateItemAction`/`deleteItemAction` calls via `requireAdmin()` — that is the real access control and is not changing. But today a volunteer who navigates to `/inventory` or `/add-item` sees the full working UI and only discovers they're blocked after submitting. Both pages should show the same "This area is for administrators." message already used in `app/admin/page.tsx`, matching the pattern established there.

- [ ] **Step 1: Gate the inventory page**

In `app/inventory/page.tsx`, import `useCurrentUser` and add a role check before the existing `loading` early return:

```tsx
import { useCurrentUser } from "@/components/nav-context";
```

Inside `InventoryPage`, after the existing state declarations, add:

```tsx
const { user, loading: loadingSession } = useCurrentUser();
```

Add this check immediately before the existing `if (loading) { ... }` block:

```tsx
if (loadingSession) return null;
if (user?.role !== "admin") {
  return (
    <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      This area is for administrators.
    </p>
  );
}
```

- [ ] **Step 2: Gate the add-item page**

In `app/add-item/page.tsx`, import `useCurrentUser` and add the same check:

```tsx
import { useCurrentUser } from "@/components/nav-context";
```

Inside `AddItemPage`, right after `const router = useRouter();`, add:

```tsx
const { user, loading: loadingSession } = useCurrentUser();
```

Add this check before the component's `return (...)`, as the first line of the render logic (before the existing `return (<div className="mx-auto max-w-md ...">`):

```tsx
if (loadingSession) return null;
if (user?.role !== "admin") {
  return (
    <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      This area is for administrators.
    </p>
  );
}
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc --noEmit && npx next lint`
Expected: PASS, no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add app/inventory/page.tsx app/add-item/page.tsx
git commit -m "feat: gate inventory and device registration UI to administrators"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run every check**

```bash
npx vitest run
npx tsc --noEmit
npx next lint
npm run build
```

Expected: 26 tests pass (18 from Phase 1 + 8 new), no type errors, no lint errors. `npm run build` still requires Firebase credentials in `.env.local` to succeed — if they are present, expect a clean build; if not, expect it to fail only at `Missing FIREBASE_PROJECT_ID`, same as Phase 1.

- [ ] **Step 2: Manual verification (requires a running dev server against a real Firebase project)**

1. Sign in as a volunteer. Confirm `/inventory` and `/add-item` both show "This area is for administrators." and neither is reachable via nav.
2. Sign in as an admin. Go to Register a Device.
3. Fill name/category/asset tag/condition, choose "Purchased," confirm only the four purchase fields appear (invoice, supplier, price, fund).
4. Switch to "Donated," confirm the purchase fields disappear and only contributor name + optional estimated value appear.
5. Submit a purchase-sourced device. Confirm it appears in `/inventory` with "Purchased from {supplier} · ₹{price}" on the card.
6. Open its edit modal, confirm the read-only Acquisition Record section shows the correct invoice/supplier/price/fund and cannot be edited.
7. Submit a donation-sourced device with no estimated value. Confirm the card shows "Donated by {name}" with no value suffix, and the edit modal omits the estimated-value line.
8. Attempt to submit the registration form with neither Purchased nor Donated selected — confirm the error "Please choose whether this device was purchased or donated." appears and no device is created.
