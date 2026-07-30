# QIDMA Medical Aid — Multi-User Platform Design

**Date:** 2026-07-30
**Status:** Approved
**Supersedes:** the single-user, JSON-file MedAid prototype

## Context

QIDMA Medical Aid is a medical equipment lending programme run by the KMCC Qatar committee for people in Kerala. The committee holds equipment — much of it donated, some purchased — and lends it to beneficiaries for a fixed period. Volunteers appointed by an administrator carry out the lending and the returns, and the committee needs a record of what it owns, what it spent, what it received, where every device is, and who did what.

The existing prototype is a single-user Next.js 14 PWA storing everything in a JSON file. It has no authentication, no concept of users, and on Vercel writes to `/tmp/db.json`, which is ephemeral and per-instance — data silently resets on cold start. That storage layer cannot support user accounts or financial records, so replacing it is a prerequisite for everything else in this spec rather than a parallel workstream.

## Goals

- Durable, multi-user storage on Firebase (Firestore + Firebase Auth), deployed on Vercel.
- Administrator-controlled user accounts, with volunteers limited to lending and returns.
- Device registry capturing condition and how each device was acquired (purchased or donated).
- Contributions of money from beneficiaries recorded at lending or at return.
- An audit trail of user activity.
- An interface a non-technical volunteer can use without training.

## Non-Goals

These are deliberately excluded. Each would be a separate spec.

- Self-service password reset. An administrator re-issues credentials instead.
- Financial reporting and exports beyond the activity log.
- Multi-language interface. WhatsApp message bodies remain bilingual as they are today.
- Offline data entry with later synchronisation.
- Any beneficiary-facing portal or login.
- Automated WhatsApp sending. `app/api/notifications/send/route.ts` still only logs the composed message; the real messaging path remains the user-initiated `wa.me` deep links. Replacing the simulation with Twilio or Baileys is separate work.

## Decisions

Recorded with their rationale, because each closes off an alternative someone will reasonably suggest later.

| Decision | Rationale |
|---|---|
| Firestore + Firebase Auth, on Vercel | Survives serverless cold starts; Firebase Auth removes the need to hand-roll password storage. |
| Server-side data access only, via Admin SDK | Business rules stay unbypassable. Firestore rules become deny-all, so there is no rule logic to get wrong. |
| No public signup | Administrator creates every account. Only appointed volunteers can move committee assets. |
| Online-only, still installable | The app is already online-only in practice; the service worker caches the shell but every data operation needs the network. Offline sync would require client-side Firestore, permissive rules, and conflict handling for two volunteers lending the same device. |
| Start with an empty database | Existing `data/db.json` records are development placeholders. No migration. |
| All amounts in INR | Confirmed with the client. No currency field is stored. If Qatar-side purchasing is ever recorded in QAR, this decision is the thing to revisit. |
| Device source is "Donated", beneficiary money is a "Contribution" | The requirements use "contribution" for both. One word for two unrelated concepts would confuse code and reports alike. |

### Interpreted requirement

"Record the user who applied the equipment" is read as **the logged-in volunteer who processed the handout**, not the beneficiary — consistent with "record user who checked-in the item". If the client meant the beneficiary who requested the item, the allocation model needs an extra field and this spec needs revising.

## Architecture

### Authentication flow

The browser uses the Firebase client SDK for exactly one operation: `signInWithEmailAndPassword`. It never reads or writes Firestore.

1. Browser signs in, receives a Firebase ID token.
2. Browser posts the token to `POST /api/auth/session`.
3. That route verifies the token with the Admin SDK and mints an httpOnly, secure, sameSite session cookie via `createSessionCookie`.
4. Server actions verify the cookie on every call, yielding `uid` and `role`.
5. `POST /api/auth/logout` clears the cookie and revokes the session.

`role` is a Firebase custom claim (`admin` or `volunteer`), so it travels inside the session cookie and costs no extra read per request. Display fields — name, mobile — live in the `users/{uid}` document.

Middleware redirects unauthenticated requests to `/login`. **Middleware is not the access control boundary**; it is a redirect convenience. Every server action independently verifies the session and the required role.

### Data access

Pages remain client components. `app/actions/*` remains the only boundary to the data layer, preserving the shape the codebase already has. Firestore is reached only through the Admin SDK, server-side.

Firestore security rules deny all client access outright.

### Module structure

Two existing files must be split. `lib/db-service.ts` (265 lines) and `app/actions.ts` (216 lines) already cover three entities each; adding users, contributions, acquisition data and audit logging to them produces files too large to work in reliably.

```
lib/
  types.ts                 # domain types; imports nothing
  firebase/
    admin.ts               # Admin SDK singleton (server-only)
    client.ts              # client SDK, auth only
  domain/                  # pure functions, no Firebase, unit-tested
    condition.ts           # condition -> item status
    allocation.ts          # overdue derivation
    receipt.ts             # receipt number formatting
    contributions.ts       # totals
  repositories/            # thin Firestore I/O
    items.ts  beneficiaries.ts  allocations.ts  users.ts
    contributions.ts  activity.ts
app/actions/
  items.ts  allocations.ts  users.ts  auth.ts
```

**Types must leave the data layer.** Client components currently import `Item`, `Beneficiary` and `Allocation` from `lib/db-service.ts`. Once that module imports `firebase-admin`, a server-only package is referenced from client code. Domain types move to `lib/types.ts`, which has no imports.

Splitting pure domain logic away from Firestore I/O is what makes the rules testable without running an emulator.

## Data model

### `users/{uid}`

`name`, `mobile`, `email`, `role` (`admin` | `volunteer`), `disabled`, `createdAt`, `createdBy`, `lastLoginAt`.

Account disabling uses Firebase Auth's native `disabled` flag; the Firestore field mirrors it for display.

### `items/{itemId}`

Existing: `assetTag` (unique), `name`, `category`, `status`, `currentAllocationId`.

Added:

- `condition` — `New` | `Used` | `Good` | `Fair` | `Needs Repair` | `Retired`
- `registeredAt` — the client's "date of device registration", entered by the user. Deliberately distinct from record creation time, because devices acquired months ago will be entered now.
- `registeredBy` — uid
- `acquisition` — one of two shapes, never both:
  - `{ source: 'purchase', invoiceNumber, supplier, price, sourceOfFund }`
  - `{ source: 'donation', contributorName, estimatedValue }`

### `beneficiaries/{id}`

`name`, `phone`, `address`, `createdAt`, `createdBy`.

Created inline during lending, deduplicated by phone number (behaviour the current cart already has). There is no pre-registration step.

The existing free-text `volunteerInCharge` field is removed. It is superseded by `allocatedBy` on the allocation, which references a real user account.

### `allocations/{id}`

Existing: `itemId`, `beneficiaryId`, `allocatedAt`, `expectedReturnAt`, `status`, `notes`, `receiptNumber`.

Added: `allocatedBy` (uid), `checkedInBy` (uid), `conditionOnReturn`, and `actualReturnedAt` as a user-editable date rather than an automatic timestamp.

### `contributions/{id}`

`beneficiaryId`, `allocationId`, `stage` (`checkout` | `checkin`), `amount`, `method` (`cash` | `upi` | `bank_transfer`), `reference`, `collectedBy` (uid), `collectedAt`.

Held in its own collection rather than nested on the allocation so totals can be computed without loading every lending record.

### `activityLog/{id}`

Append-only. `at`, `actorUid`, `actorName`, `action`, `targetType`, `targetId`, `summary`.

Actions: `USER_CREATED`, `USER_DISABLED`, `ITEM_REGISTERED`, `ITEM_UPDATED`, `ITEM_DELETED`, `ALLOCATED`, `CHECKED_IN`, `CONTRIBUTION_RECORDED`.

The actor's name is copied in rather than only referenced, so entries stay readable after a volunteer leaves the committee.

### `counters/receipts`

A single document holding the last issued receipt sequence, incremented inside a transaction.

## Domain rules

**Condition determines status, at registration and at return alike.**

| Condition | Resulting item status |
|---|---|
| `New`, `Used`, `Good`, `Fair` | `AVAILABLE` |
| `Needs Repair` | `MAINTENANCE` |
| `Retired` | `RETIRED` |

Registration offers `New`, `Used`, `Needs Repair`. Return offers `Good`, `Fair`, `Needs Repair`, `Retired`. Both write the same `condition` field and both apply the table above, so a device registered as needing repair is never offered for lending.

**`OVERDUE` remains derived, never stored.** An allocation is overdue when `status === 'ACTIVE' && expectedReturnAt < now`. The persisted status stays `ACTIVE`.

**Lending is a single transaction.** Creating the allocation, flipping the item to `ALLOCATED`, setting `currentAllocationId`, allocating the receipt number, and writing any contribution all commit together, with the availability check performed inside the transaction. Two separate writes allow the same device to be lent twice when volunteers work concurrently, and allow money to be collected with no record of it.

**Returning is likewise a single transaction** covering the allocation update, the item status change derived from condition, and any contribution.

**Receipt numbers come from the counter document**, formatted `QID-{year}-{seq:0000}`. The current `allocations.length + 1` scheme reuses numbers after any deletion, on a document beneficiaries keep.

## Interface

Navigation splits by role rather than growing. Adding device registration, user management and an activity log to the existing four nav items would put seven destinations in front of a volunteer.

**Volunteers see two tabs: Give Out, and Returns.** Those are the only two operations they perform. Inventory management, registration and administration are not merely hidden from them — the server rejects those actions for their role.

**Administrators see those two tabs plus an Admin hub**, a single screen of large labelled cards leading to Devices, Register a Device, Volunteers, and Activity Log.

Navigation uses plain verbs — "Give Out", "Returns" — while receipts and reports retain the committee's formal vocabulary.

### Screens

- **`/login`** — one branded card, nothing else on the page.
- **Give Out (`/`)** — the available-only filter defaults to on, since a volunteer lending equipment has no reason to see retired or already-lent devices; a toggle reveals everything. Beneficiary entry defaults to the new-person form. The acting volunteer is recorded automatically, with no interface element. The contribution box sits collapsed behind an "Add contribution" link, because most handouts involve no money.
- **Returns (`/allocations`)** — the check-in dialog gains an actual return date defaulting to today and editable for equipment returned earlier, a condition selector, and the same collapsed contribution box.
- **Register a Device** — administrator only. The form asks *Purchased or Donated* first and then shows only that branch, so a volunteer faces five fields rather than nine.
- **Devices, Volunteers, Activity Log** — administrator only, behind the hub.
- **Receipt (`/receipt/[id]`)** — rebranded, with any contribution shown as an acknowledgement line. Its "Volunteer In-charge" line now resolves to the recorded `allocatedBy` user's name rather than the removed free-text `volunteerInCharge` field.

### Branding

Name "QIDMA Medical Aid", tagline "By KMCC Qatar Vanimal Panchayat", applied to the layout header, `public/manifest.json`, page metadata, and the receipt.

### Error states

Being online-only obliges two things: a visible "no connection" banner rather than buttons that fail silently, and disabled submit states while a write is in flight.

Server actions keep the existing `{ success, error? }` contract; the screens already branch on `.success`.

## Security

- Service account credentials live in Vercel environment variables. The private key is never committed.
- Firestore rules deny all client access.
- Session cookies are httpOnly, secure, sameSite.
- Every server action verifies session and role server-side. Hiding a navigation item is not access control.

## Testing

The repository has no test framework. Vitest is added, covering the pure functions in `lib/domain/`:

- condition to status mapping
- overdue derivation
- receipt number formatting and sequencing
- contribution totals
- role gating helpers

These are the rules that corrupt records silently when wrong. No end-to-end or component tests — disproportionate for an application of this size.

## Bootstrapping

Because an administrator creates every account, the first administrator cannot be created through the interface. A one-time script, run locally against the service account, creates that account and sets its custom claim. Without it there is no way into the deployed application.

## Build order

Four phases, each independently shippable.

1. **Foundation** — Firebase wiring, type extraction, repository and action split, login, session cookies, role gating, bootstrap script, QIDMA rebrand. Blocks everything else.
2. **Device registry** — condition, acquisition details, registration date, progressive-disclosure form, inventory restricted to administrators.
3. **Giving out** — available-only filter, recorded volunteer, inline beneficiaries, checkout contribution, transactional lending, receipt counter.
4. **Returns, audit and polish** — recorded check-in user, editable return date, check-in contribution, activity log screen, receipt rebrand, interface and theme pass.

## Risks

- **Firestore reads on the ledger.** Screens currently fetch all items, beneficiaries and allocations on load. At committee scale this is acceptable; if the inventory grows into the thousands, the ledger needs pagination and server-side filtering.
- **Session cookie expiry.** Firebase session cookies last at most 14 days. Volunteers will be signed out periodically, which is correct behaviour but should not appear as an error.
- **Initial password delivery** relies on an administrator relaying a generated password over WhatsApp. This is a deliberate trade against email deliverability, and it means the password passes through a third-party messenger.
