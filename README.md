# QIDMA Medical Aid

*By KMCC Qatar Vanimal Panchayat*

A mobile-first Progressive Web Application (PWA) and Point of Sale (POS)-style system for the KMCC Qatar committee's medical aid programme, used to register, track, and lend shared medical equipment (wheelchairs, oxygen concentrators, hospital beds, etc.) to beneficiaries in Kerala, and to record the volunteers who handle each handout and return.

## 🚀 Key Features

1. **Give Out (`/`)**:
   - Fast, visual equipment grid with category filtering and search.
   - Quick drawer-based checkout supporting existing beneficiary selection or on-the-fly beneficiary registration — no pre-registration required.

2. **Returns (`/allocations`)**:
   - Active lending ledger showing expected return dates and real-time status (Active, Overdue, Returned).
   - Return check-in records the actual return date, the device's condition, and the volunteer who processed it.

3. **Admin — Devices (`/inventory`)**:
   - Dashboard to view, search, and update every registered device.
   - Edit model names, categories, asset tags, condition, and operational status. Deleting an item is blocked while it is on active loan.

4. **Admin — Register a Device (`/add-item`)**:
   - Records a device's condition (New, Used, Needs Repair) and registration date.

5. **Admin — Volunteers (`/admin/users`)**:
   - Administrator-only account creation. Volunteers cannot self-register; an admin creates each account and shares the generated initial password over WhatsApp.

6. **Interactive WhatsApp Integration**:
   - Deep links (no third-party API) to share the printed receipt and to send return reminders, in English and Malayalam (Latin script).

7. **PWA Capability**:
   - Installable to the home screen, with a cached app shell for fast repeat loads. Data operations (checkout, check-in, inventory changes) require an internet connection.

---

## 🛠️ Technology Stack

- **Core**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Lucide Icons
- **Auth**: Firebase Authentication (session cookies, admin-created accounts, role-based access)
- **Database**: Firestore, accessed only from the server via the Firebase Admin SDK
- **State Management**: React state with Next.js Server Actions
- **Testing**: Vitest, covering the pure domain rules in `lib/domain/`

---

## 💻 Local Setup & Development

### 1. Prerequisites

- Node.js (v18.x or v20.x recommended)
- npm
- A Firebase project with Authentication (Email/Password provider) and Firestore enabled

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your Firebase web app config (client SDK) and service account credentials (Admin SDK) — see the comments in `.env.example` for exactly where to find each value in the Firebase console. The same variables must also be added to the Vercel project settings for deployment.

### 4. Create the First Administrator

No account can be created through the app until one exists — an administrator creates every other account. Set the `BOOTSTRAP_ADMIN_*` values in `.env.local`, then run:

```bash
npm run bootstrap:admin
```

Sign in with that account, then clear the `BOOTSTRAP_ADMIN_*` values from `.env.local`.

### 5. Run the Development Server

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000).

### 6. Run Tests

```bash
npm run test:run   # run once
npm run test       # watch mode
npm run typecheck  # tsc --noEmit
```

### 7. Build for Production

```bash
npm run build
```

---

## 📁 Repository Structure

```text
├── app/
│   ├── actions/              # Server Actions, split by entity (items, allocations, users, session)
│   ├── api/auth/              # Session cookie exchange and logout routes
│   ├── login/                 # Sign-in page
│   ├── admin/                 # Admin hub, volunteers, activity log (admin-only)
│   ├── layout.tsx             # Global app wrapper, navigation headers
│   ├── page.tsx               # Give Out (checkout) view
│   ├── allocations/           # Returns ledger view
│   ├── inventory/             # Device manager (admin-only)
│   ├── add-item/              # Device registration form (admin-only)
│   └── receipt/[id]/          # Thermal printer receipt template & WhatsApp triggers
├── components/
│   ├── bottom-nav.tsx         # Mobile bottom navigation (role-aware)
│   ├── desktop-nav.tsx        # Desktop navigation (role-aware)
│   ├── nav-context.tsx        # Current signed-in user, shared across the app
│   ├── sign-out-button.tsx    # Sign out control
│   ├── checkout-cart.tsx      # Slide-out checkout drawer form
│   └── pwa-register.tsx       # PWA Service Worker registration
├── lib/
│   ├── types.ts               # Client-safe domain types (imports nothing)
│   ├── domain/                # Pure business rules, unit-tested (condition, allocation, receipt)
│   ├── firebase/               # Admin SDK (server-only) and client SDK (auth only) singletons
│   ├── auth/                  # Session cookie helpers and role guards
│   └── repositories/          # Firestore data access, one file per entity
├── scripts/
│   └── bootstrap-admin.ts     # One-time first-administrator creation
├── public/
│   ├── logo.png                # QIDMA logo graphic
│   ├── manifest.json           # PWA configuration
│   └── sw.js                   # Offline shell caching service worker
├── firestore.rules             # Deny-all rules — Firestore is reached only via the Admin SDK
└── .env.example                # Reference for required environment variables
```
