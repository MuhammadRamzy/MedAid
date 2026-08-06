# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QIDMA Medical Aid ("By KMCC Qatar Vanimal Panchayat") — a mobile-first Next.js 14 PWA used by the KMCC Qatar committee to register, lend, and track shared medical equipment (wheelchairs, oxygen concentrators, hospital beds) for beneficiaries in Kerala. Volunteers are appointed by an administrator; every handout and return records the acting user. Screens: Give Out (`/`), Returns (`/allocations`), Admin hub (`/admin`) gating Devices (`/inventory`), Register a Device (`/add-item`), Volunteers (`/admin/users`) and Activity Log (`/admin/activity`), plus a thermal-printer receipt view (`/receipt/[id]`).

## Commands

```bash
npm run dev            # dev server on :3000
npm run build          # production build — this is what typechecks the project
npm run lint            # next lint (eslint-config-next); does NOT typecheck
npm run typecheck       # tsc --noEmit, faster than a full build
npm run test            # vitest, watch mode
npm run test:run        # vitest, single run
npx vitest run path/to/file.test.ts   # a single test file
npm run bootstrap:admin # one-time: create the first administrator (see Auth below)
```

Tests cover only the pure functions in `lib/domain/` (condition→status, overdue derivation, receipt numbering). There is no end-to-end or component test suite — verify UI changes by running the app.

## Architecture

### Data flow: client pages → server actions → Firestore repositories

Every page is a `"use client"` component. There are no server components fetching data. Pages call the server actions under `app/actions/` from `useEffect`, hold the result in `useState`, and re-run their own `loadData()`/`loadItems()` after a mutation — the `revalidatePath()` calls inside the actions do little for these pages, so **after any mutation the page must refetch explicitly** or the UI goes stale.

Actions never throw across the client boundary: they return `{ success, error? }` and log server-side. Keep that contract.

Firestore is reached **only from the server**, only through `lib/repositories/*.ts`, which use the Admin SDK (`lib/firebase/admin.ts`). No client component, and no Firestore security rule, ever grants direct browser access — `firestore.rules` denies everything, because nothing needs to get through it.

### Auth: session cookie, not client Firestore

The browser's Firebase SDK (`lib/firebase/client.ts`) is used for exactly two things: `signInWithEmailAndPassword` and `signInWithPopup(googleProvider)`, both on [app/login/page.tsx](app/login/page.tsx). Every sign-in — either provider — funnels through the same two-step exchange before a session cookie exists:

1. `POST /api/auth/provision` — verifies the ID token and calls `ensureUserProfile()` (`lib/repositories/users.ts`). For an admin-created PIN account this is a no-op existence check. For a **first-time Google sign-in**, it creates the `users/{uid}` Firestore doc and sets the `role: "volunteer"` custom claim — there is no admin step first for Google.
2. The client **force-refreshes its ID token** (`getIdToken(true)`) before the next call. The token from step 1 was minted before any claim that step could have just set, so it cannot itself carry it — this refresh is what makes the following step's cookie correct, not an optimization to skip.
3. `POST /api/auth/session` — the Admin SDK exchanges the refreshed token for an httpOnly session cookie (`lib/auth/session.ts`, cookie name `qidma_session`). Server actions call `requireUser()`/`requireAdmin()` to read `{ uid, email, role }` from that cookie — `role` is a Firebase custom claim, not a Firestore read, so it costs nothing extra per request.

**Two account paths, different trust levels.** Email + 6-digit PIN accounts are still admin-created only, via `createUserAction` (`app/actions/users.ts`), which generates the PIN and returns it once for the admin to relay over WhatsApp — `lib/domain/pin.ts` is why it's 6 digits specifically (Firebase's own password minimum). Google sign-in is **open self-signup**: anyone with a Google account gets a `volunteer` account automatically on first login. An admin promotes/demotes via `setUserRoleAction`, or removes an account entirely via `deleteUserAction` (`lib/repositories/users.ts` `setUserRole`/`deleteUser` — both update the Firestore doc *and* the Auth record/custom claim; promotion and disable also call `revokeRefreshTokens` so the change is immediate, not "next cookie expiry"). The very first administrator can't be created through either path — run `npm run bootstrap:admin` with `BOOTSTRAP_ADMIN_*` set in `.env.local` (PIN is `BOOTSTRAP_ADMIN_PIN`, optional — the script generates and prints one if it's missing or invalid), then clear those values.

Because accounts can now be deleted (not just disabled), allocations store the acting user's name **at write time** (`Allocation.allocatedByName` / `checkedInByName`) rather than resolving it live against the `users` collection — `lib/repositories/allocations.ts` no longer joins against `users` at all. Deleting an account can never blank out a historical "Given out by" / "Checked in by" entry.

`middleware.ts` redirects requests with no session cookie to `/login`, but it runs on the Edge runtime where `firebase-admin` cannot load — it only checks cookie *presence*, hardcoding the cookie name as a literal string rather than importing it. **Middleware is not the authorization boundary.** Every server action independently calls `requireUser()`/`requireAdmin()`; a hidden nav link is not access control.

### Domain rules live in `lib/domain/`, Firestore I/O lives in `lib/repositories/`

This split is what makes the business rules unit-testable without a Firestore emulator:

- **`statusForCondition()`** (`lib/domain/condition.ts`) — a device's `condition` determines its `status`. `Needs Repair` → `MAINTENANCE`, `Retired` → `RETIRED`, everything else (`New`/`Used`/`Good`/`Fair`) → `AVAILABLE`. Applied identically at device registration and at check-in return — one vocabulary, one function, two call sites (`lib/repositories/items.ts` `createItem`, `lib/repositories/allocations.ts` `returnAllocation`).
- **`deriveStatus()`** (`lib/domain/allocation.ts`) — `OVERDUE` is never stored. An allocation stays `ACTIVE` in Firestore; overdue is computed at read time from `expectedReturnAt` vs. now. Anything that needs the real status must go through `listAllocations()`/`getAllocation()`, not read `status` off a raw document.
- **`formatReceiptNumber()` / `nextSequence()`** (`lib/domain/receipt.ts`) — receipt numbers (`QID-{year}-{seq}`) come from a transactional counter document (`counters/receipts`), not a collection count, so deleting an allocation never causes number reuse.

### Lending and returns are Firestore transactions

`createAllocation()` and `returnAllocation()` (`lib/repositories/allocations.ts`) each run inside `adminDb.runTransaction()`. Creating an allocation reads the item, checks `status === "AVAILABLE"` (throwing `ItemUnavailableError` otherwise), reads and increments the receipt counter, and writes the allocation + item update together — this is what stops two volunteers from lending the same device at once. Returning likewise commits the allocation update and the condition-derived item status together. Don't split these into separate writes.

### Checkout → receipt

The cart holds N items but produces **one allocation per item**, all for the same beneficiary/return date. [components/checkout-cart.tsx](components/checkout-cart.tsx) sends one `createAllocationAction` call per item — beneficiary creation happens inside that action (`findOrCreateBeneficiary`, deduplicated by phone), not as a separate step — collects the resulting ids, then routes to `/receipt/{id1,id2,...}`. The receipt route parses a **comma-joined list** of allocation ids and renders them as one multi-item receipt.

### WhatsApp: two separate mechanisms

1. **Real, user-initiated**: `wa.me` deep links built client-side in [app/receipt/[id]/page.tsx](app/receipt/[id]/page.tsx), [app/allocations/page.tsx](app/allocations/page.tsx), and the volunteer-PIN share in [app/admin/users/page.tsx](app/admin/users/page.tsx). The user taps and sends from their own WhatsApp.
2. **Simulated**: [app/api/notifications/send/route.ts](app/api/notifications/send/route.ts) only `console.log`s the composed message — nothing is sent. This is still the case; replacing it with a real Twilio/Baileys integration is out of scope for the current phase.

### UI conventions

- **Portals are deliberate.** The cart button renders into `#header-cart-portal` in [app/layout.tsx](app/layout.tsx); the checkout drawer and the inventory edit modal render into `document.body`. This was a fix for `position: fixed` breaking inside transformed ancestors on mobile — don't inline these back into the page tree. Portals are guarded by a `mounted` state flag to avoid hydration mismatch.
- **Role-aware nav is a client concern.** `components/nav-context.tsx` exposes `useCurrentUser()`, populated client-side from `getCurrentUserAction()`. `BottomNav`/`DesktopNav`/`SignOutButton` all read it and render nothing until a user is present. This is convenience UI, not security — see Auth above.
- **Styling** is Tailwind over HSL CSS variables in [app/globals.css](app/globals.css) (`--primary` is QIDMA teal). The codebase mixes semantic tokens (`bg-card`, `text-muted-foreground`) with literal `teal-*`/`emerald-*`/`rose-*` classes; match the surrounding file rather than converting.
- A `.dark` variable block exists but nothing ever sets the class — there is no working dark mode.
- **Print**: receipts rely on the `@media print` rule that hides everything except `.print-area`. Any new receipt markup must sit inside `.print-area`.
- Layout reserves `pb-16` on mobile for the fixed [components/bottom-nav.tsx](components/bottom-nav.tsx).
- The service worker ([public/sw.js](public/sw.js)) is network-first with cache fallback and skips `/api` and `/_next`. It is **not registered on localhost** ([components/pwa-register.tsx](components/pwa-register.tsx)), so PWA/offline behavior can only be tested against a deployed or non-localhost host. Bump `CACHE_NAME` when changing cached assets. The app is **online-only**: no data operation works offline, only the shell is cached.

## Conventions

- Path alias `@/*` maps to the repo root.
- TypeScript is `strict`. Shared domain types (`Item`, `Beneficiary`, `Allocation`, `AllocationWithRefs`, `UserProfile`, `SessionUser`) live in `lib/types.ts`, which imports nothing — it's safe for client components to import. Never import a repository or `lib/firebase/admin.ts` from a client component; both require `import "server-only"` and will break the build if pulled into browser code.
- All monetary/domain amounts in this phase are INR only; no currency field exists.
- Dates are stored as ISO strings (never Firestore `Timestamp` — those aren't JSON-serializable across the Server Action boundary) and displayed with `toLocaleDateString("en-IN", ...)`.
- Phone numbers are stored in `+91…` form and stripped to digits (`replace(/\D/g, "")`) when building `wa.me` links.
- `firebase-admin` pulls in `@google-cloud/firestore`, whose optional tracing module requires `@opentelemetry/api` at runtime even though it's not a hard dependency — it's installed explicitly in `package.json` to keep `next build` from failing with `MODULE_NOT_FOUND`.
