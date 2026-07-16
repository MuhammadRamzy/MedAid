# KMCC Medical Equipment Distribution POS & PWA (MedAid)

An industrial-grade, mobile-first Progressive Web Application (PWA) and Point of Sale (POS) system designed for the Kerala Muslim Cultural Centre (KMCC) charity wing to distribute, track, and manage shared medical equipment (wheelchairs, oxygen concentrators, hospital beds, etc.) to beneficiaries.

## 🚀 Key Features

1. **POS-Style Checkout Cart (`/`)**:
   - Fast, visual product grid with category filtering (Mobility, Respiratory, Comfort, Orthopedic) and tag-based searching.
   - Quick drawer-based checkouts supporting existing beneficiary selection or new beneficiary registration.

2. **Allocations Ledger (`/allocations`)**:
   - Active distribution tracking list showing expected return dates and real-time status markers (Active, Overdue, Returned).
   - "Process Return Check-In" dialog to register returns and flag equipment condition status.

3. **Stock & Maintenance Manager (`/inventory`)**:
   - Dedicated dashboard panel to view, update, and search all assets.
   - Full CRUD support: Edit model names, categories, asset tags, status (Available, Maintenance, Retired), and condition.
   - Restores items flagged for `MAINTENANCE` back to `AVAILABLE` status for POS checkout, with safety checks to prevent deleting active leases.

4. **Interactive WhatsApp Integration**:
   - **WhatsApp Receipt Sharing**: Direct button on the thermal receipt printer page (`/receipt/[id]`) that generates a pre-compiled deep link to share receipt parameters in English and Malayalam.
   - **WhatsApp Return Reminders**: Deep links on the Allocation Ledger cards to remind patients of active/overdue borrow deadlines.

5. **PWA Capability**:
   - Offline-ready manifest config (`public/manifest.json`) and service worker cache (`public/sw.js`) optimized for poor network environments in remote areas.

---

## 🛠️ Technology Stack

- **Core**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database**: Serverless File-Based JSON DB (optimized for Vercel serverless functions)
- **State Management**: React State with Next.js Server Actions

---

## ☁️ Serverless Compatibility (Vercel Optimization)

To handle serverless hosting constraints where the local disk is read-only and stateless:
- **Writeable `/tmp` Pathing**: Detects Vercel hosting (`process.env.VERCEL === '1'`) and sets the database storage path to `/tmp/db.json` which is writable in serverless runtimes.
- **Auto-Seeding**: Statically bundles the initial seed data (`data/db.json`) during build. If the active serverless database does not exist in `/tmp`, it is automatically seeded with initial equipment units (wheelchairs, beds, O2 concentrators) and allocation records.
- This ensures zero filesystem write errors (`EROFS`) and guarantees page loading on serverless hosts.

---

## 💻 Local Setup & Development

### 1. Prerequisites
- Node.js (v18.x or v20.x recommended)
- npm (or yarn/pnpm)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The application will start on [http://localhost:3000](http://localhost:3000).

### 4. Build for Production
```bash
npm run build
```
Creates an optimized production bundle inside the `.next` folder.

---

## 📁 Repository Structure

```text
├── app/
│   ├── actions.ts           # Server Actions for DB operations (CRUD)
│   ├── layout.tsx           # Global Next.js app wrapper & navigation headers
│   ├── page.tsx             # POS Checkout view
│   ├── allocations/         # Allocation Ledger view
│   ├── inventory/           # Stock Manager CRUD view
│   ├── add-item/            # Item creation form
│   └── receipt/[id]/        # Thermal printer receipt template & WhatsApp triggers
├── components/
│   ├── bottom-nav.tsx       # Elevated mobile dock bottom menu
│   ├── checkout-cart.tsx    # Slide-out POS checkout drawer form
│   └── pwa-register.tsx     # PWA Service Worker register hooks
├── data/
│   └── db.json              # Source Seed Database (initial stock)
├── lib/
│   └── db-service.ts        # Database read, write, and Vercel compatibility service
├── public/
│   ├── logo.png             # Official KMCC logo graphic
│   ├── manifest.json        # PWA configuration
│   └── sw.js                # Offline caching service worker
└── tsconfig.json            # TypeScript compile configurations
```
