# FN-APP (Phase 1) · Minimalist Local-First Personal Finance PWA

**FN-APP** is an offline-first, judgment-free personal finance progressive web application designed with the **Clean 80/10/10 Editorial + Geometric Pop Buddies** visual language and **Money+ 3-Second Hybrid Quick-Add**.

---

## Key Capabilities (Milestones M0 – M6)

- **M0. Clean Architecture, Bilingual (`EN` Default / `VI`) & Money+ UI Kit**
  - Strict 4-layer architecture (`src/domain/`, `src/db/`, `src/features/`, `src/shared/`).
  - Full PostgreSQL / Supabase schema (`supabase/migrations/`) with Row-Level Security (RLS) on 100% of tables and immutable `audit_events` trigger.
  - 5 Geometric Pop Theme Presets + Light/Dark/System modes (`src/shared/theme/tokens.css`).
- **M1. Core Double-Entry Ledger (`src/domain/ledger/`)**
  - Integer minor-unit currency engine (`VND`, `USD`) with zero floating-point drift.
  - Strategy Pattern covering all 12 transaction types (`expense`, `income`, `transfer` with optional fee, `opening_balance`, `credit_card_spend`, `credit_card_payment`, `credit_card_refund`, `debt_borrow`, `debt_lend`, `debt_repay`, `debt_collect`, `adjustment`).
- **M2. 3-Second Hybrid Quick Input & Ledger Search (`src/domain/quick-parser/`)**
  - Vietnamese + English natural-language parser (`"phở 45k"`, `"áo 75k"`, `"grab 32tr5 #di-lam"`) with subcategory auto-suggestion and self-learning merchant aliases (`hit_count >= 2`).
  - Soft-delete with 5-second Undo toast and multi-filter ledger view.
- **M3. Progressive 7-Step Onboarding, Reconcile, Debt Book, Credit Cards & Recurring Rules**
  - 1-screen Zero-Anxiety start + 7-step progressive checklist on Home.
  - Actual Balance Reconcile (`buildReconcileAdjustmentBundle`), Split Bill / Paid-for-Others (`group_id`), Debt Book with polite reminder generator, and dynamic Recurring & Installment confirmation.
- **M4. Home Dashboard, Interactive Charts & Weekly Story Recap**
  - Interactive SVG Category Donut Chart & 8-Week / Daily Bar Trend Chart with transaction drill-down.
  - Rule-based Monday Weekly Story Recap with privacy-safe Story Card PNG export.
- **M5. PWA, Offline Outbox Sync, Lock-Screen Safe Notifications & Engagement**
  - Service Worker (`public/sw.js`) + `OutboxSyncEngine` with Atomic Transaction Bundles, idempotent deduplication, and Dead-Letter Queue isolation.
  - Web Push scheduler (`max 2 notifications/day`, Quiet Hours `22:00–07:00`, 100% Lock-Screen Safe with zero money/name leaks).
  - Daily Streak + automatic 1/week Streak Freeze + Milestone Theme Unlocks.
- **M6. Security (Salted PIN App Lock + Privacy Blur), Data Portability (CSV/JSON) & E2E**
  - Client-side Privacy App Lock (`PBKDF2-SHA256` with random salt) and automatic background Privacy Blur Overlay.
  - CSV Export with Formula Injection defense (`escapeCsvCell`), 100% lossless Full JSON Snapshot Backup & Restore, Unsynced Outbox Sign-Out Guard, 2-Step Permanent Account Deletion, and Zero-PII Analytics Tracker.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. Press `/` or `n` on desktop to open the 3-Second Quick-Add sheet immediately.

### 3. Run Verification Suite (Typecheck, Lint, Unit/E2E Tests & Production Build)
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Deploying to Production (Supabase + Static PWA Host)

1. **Database & RLS Migrations:**
   Push the SQL migrations under `supabase/migrations/` and seed categories via `supabase/seed.sql`.
2. **Edge Function & `pg_cron`:**
   Deploy `supabase/functions/push-dispatcher/index.ts` for hourly lock-screen-safe Web Push reminders.
3. **Frontend PWA Build:**
   Run `npm run build` and deploy the generated `dist/` folder (including `manifest.webmanifest` and precached Service Worker) to Cloudflare Pages, Vercel, or Netlify.

