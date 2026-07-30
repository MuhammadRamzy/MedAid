# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KMCC Medical Equipment Distribution POS — a mobile-first Next.js 14 PWA used by the Kerala Muslim Cultural Centre charity wing to lend medical equipment (wheelchairs, oxygen concentrators, hospital beds) to beneficiaries and track returns. Four screens: POS checkout (`/`), allocations ledger (`/allocations`), stock manager (`/inventory`), add item (`/add-item`), plus a thermal-printer receipt view (`/receipt/[id]`).

## Commands

```bash
npm run dev      # dev server on :3000
npm run build    # production build — this is what typechecks the project
npm run lint     # next lint (eslint-config-next); does NOT typecheck
npx tsc --noEmit # typecheck alone, faster than a full build
```

There is no test framework, test script, or test file in this repo. Verify changes by running the app.

## Architecture

### Data flow: client pages → server actions → JSON file DB

Every page is a `"use client"` component. There are no server components fetching data and no route handlers for data. Pages call the server actions in [app/actions.ts](app/actions.ts) from `useEffect`, hold the result in `useState`, and re-run their own `loadData()`/`loadItems()` after a mutation. The `revalidatePath()` calls inside the actions therefore do almost nothing for these pages — **after any mutation, the page must refetch explicitly** or the UI goes stale.

`app/actions.ts` is the only module allowed to touch [lib/db-service.ts](lib/db-service.ts). Actions never throw: they return `{ success, error? }` and log server-side. Keep that contract — the client screens all branch on `.success`.

### The database

[lib/db-service.ts](lib/db-service.ts) is a hand-rolled JSON store over a single file, with:

- **A module-level `dbCache` singleton.** `readDb()` returns the *same object* every call, and mutations (`db.items.push(...)`, `db.items[i].status = ...`) mutate that cached object before `writeDbAsync` persists it. In-memory state changes even if the disk write fails, and the cache lives for the process lifetime — a stale cache survives until the server restarts.
- **A serialized write queue** (`writeQueue`) so overlapping writes cannot corrupt the file.
- **Path switching by host**: local dev writes to `data/db.json`; when `process.env.VERCEL === "1"` it writes to `/tmp/db.json`, seeded on first read from the statically imported `data/db.json`. On Vercel this makes data ephemeral and per-instance — writes are not shared between lambda invocations and vanish on cold start.

**`data/db.json` is git-tracked.** Running the app locally mutates it, so `git status` will show it dirty after any checkout/return. Check whether a `data/db.json` diff is intended seed-data change or incidental runtime noise before committing.

### Domain rules that live in code, not data

- **`OVERDUE` is never stored.** `dbService.getAllocations()` derives it at read time: `status === "ACTIVE" && expectedReturnAt < now`. The persisted allocation stays `ACTIVE`. Don't add an OVERDUE write path; anything that needs the status must go through `getAllocations()`/`getAllocationById()`.
- **Return condition drives item status by string match.** `returnAllocation()` lowercases `conditionOnCheckIn` and maps `"needs repair"` → `MAINTENANCE`, `"retired"` → `RETIRED`, everything else → `AVAILABLE`. The strings come from a `<select>` in [app/allocations/page.tsx:441-445](app/allocations/page.tsx#L441-L445) (`Excellent`/`Good`/`Fair`/`Needs Repair`/`Retired`). Changing either side without the other silently sends items to the wrong status.
- **Item ↔ allocation link is two-way and maintained manually**: `createAllocation` sets the item to `ALLOCATED` + `currentAllocationId`; `returnAllocation` clears it. `deleteItem` also cascades away that item's allocations.
- **Receipt numbers** are `REC-{year}-{seq}` where seq is `allocations.length + 1` — deletions make it reuse numbers.
- Categories are hardcoded in two places: the filter pills in [app/page.tsx:39](app/page.tsx#L39) and the `<select>` in [app/add-item/page.tsx](app/add-item/page.tsx). Add a category to both.

### Checkout → receipt

The cart holds N items but produces **one allocation per item**, all for the same beneficiary/return date. [components/checkout-cart.tsx](components/checkout-cart.tsx) loops `createAllocationAction`, collects the ids, then routes to `/receipt/{id1,id2,...}` — the receipt route parses a **comma-joined list** of allocation ids and renders them as one multi-item receipt.

### WhatsApp: two separate mechanisms

1. **Real, user-initiated**: `wa.me` deep links built client-side in [app/receipt/[id]/page.tsx](app/receipt/[id]/page.tsx) and [app/allocations/page.tsx](app/allocations/page.tsx). The user taps and sends from their own WhatsApp. Message bodies are bilingual (English + Malayalam in Latin script).
2. **Simulated**: [app/api/notifications/send/route.ts](app/api/notifications/send/route.ts) only `console.log`s the composed message — nothing is sent. Server actions fire it via `fetch` to `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`) inside a swallowed try/catch, so failures are silent by design. This is the seam where a real Twilio/Baileys integration would go.

### UI conventions

- **Portals are deliberate.** The cart button renders into `#header-cart-portal` in [app/layout.tsx](app/layout.tsx); the checkout drawer and the inventory edit modal render into `document.body`. This was a fix for `position: fixed` breaking inside transformed ancestors on mobile — don't inline these back into the page tree. Portals are guarded by a `mounted` state flag to avoid hydration mismatch.
- **Styling** is Tailwind over HSL CSS variables in [app/globals.css](app/globals.css) (`--primary` is KMCC teal). Note the codebase mixes semantic tokens (`bg-card`, `text-muted-foreground`) with literal `teal-*`/`emerald-*`/`rose-*` classes; match the surrounding file rather than converting.
- A `.dark` variable block exists but nothing ever sets the class — there is no working dark mode.
- **Print**: receipts rely on the `@media print` rule that hides everything except `.print-area`. Any new receipt markup must sit inside `.print-area`.
- Layout reserves `pb-16` on mobile for the fixed [components/bottom-nav.tsx](components/bottom-nav.tsx).
- The service worker ([public/sw.js](public/sw.js)) is network-first with cache fallback and skips `/api` and `/_next`. It is **not registered on localhost** ([components/pwa-register.tsx](components/pwa-register.tsx)), so PWA/offline behavior can only be tested against a deployed or non-localhost host. Bump `CACHE_NAME` when changing cached assets.

## Conventions

- Path alias `@/*` maps to the repo root (`@/lib/db-service`, `@/components/...`).
- TypeScript is `strict`. Shared domain types (`Item`, `Beneficiary`, `Allocation`) are exported from `lib/db-service.ts` and imported by client components — that file must stay safe to import from the client type-side (it is, since only types cross the boundary).
- Dates are stored as ISO strings and displayed with `toLocaleDateString("en-IN", ...)`.
- Phone numbers are stored in `+91…` form and stripped to digits (`replace(/\D/g, "")`) when building `wa.me` links.
