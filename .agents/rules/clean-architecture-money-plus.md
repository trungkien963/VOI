---
description: Clean Architecture, OOP Inheritance, Reusable Component Decomposition, and Money+ UX Standards for FN-APP
---

# FN-APP Engineering & Product Architecture Rules

1. **Strict Clean Architecture & Unidirectional Dependencies**
   - `src/domain/`: Pure TypeScript business logic (entities, money arithmetic, calculator evaluator, ledger strategies, parser). Zero React, DOM, or IndexedDB imports.
   - `src/db/`: Local-first Dexie schema, `BaseRepository<TEntity, TKey>`, Unit-of-Work transactions, and Outbox Sync. Depends only on `src/domain/`.
   - `src/shared/`: Design system tokens, i18n, and reusable Atomic/Compound UI primitives (`Card`, `Button`, `SegmentedControl`, `BottomSheet`, `CalculatorKeypad`, `CategoryGridPicker`, `EmptyStateCard`, `GeometricBuddy`). Must never import from `src/features/`.
   - `src/features/`: Self-contained feature views and hooks (`home`, `quick-add`, `analytics`, `assets`, `settings`).
   - `src/app/`: Lightweight composition root and navigation shell (`AppShell.tsx`, `ui-store.ts`).

2. **Component Decomposition & File Size Guardrail (< 200 LOC)**
   - Follow Single Responsibility Principle (SRP). Keep every UI component and module concise (< 180–200 lines).
   - Never place multiple full-screen tab implementations inside `AppShell.tsx`.
   - Prefer Compound Components (`Card.Header`, `Card.Body`, `Card.Footer`) and generic typed primitives (`SegmentedControl<T>`) for maximum reuse.

3. **OOP Inheritance & Strategy Pattern for Data & Ledger**
   - All Dexie table repositories must extend `BaseRepository<TEntity, TKey>` (`src/db/repositories/base-repository.ts`) to inherit atomic CRUD + `sync_outbox` mutation queueing.
   - All transaction types must use `BaseLedgerStrategy` subclasses (`src/domain/ledger/strategies.ts`) so ledger invariants and `cached_balance_minor` updates are enforced uniformly.

4. **Money+ UX + Warm Editorial 80 / 10 / 10 Visual System & 8 Semantic Shapes**
   - **80% Warm Editorial Cream Canvas:** `#F7F4EB` background + `#FFFFFF` cards (`1px solid #E8E3D5` border, `24px` radius).
   - **10% Editorial Deep Ink (`#18181B`):** Crisp typography, delicate `1.5px–1.7px` line-art character accessories (glasses, caps, headphones, curly/spiky hair), primary buttons, and the 5-slot floating dock.
   - **10% Borderless Flat Geometric Pop Palette (8 Semantic Shapes — NO black outline around colored bodies):**
     1. `triangle` (`#FF6B35` Coral Orange) = **Cost / Chi tiêu**
     2. `square` (`#10B981` Mint Emerald) = **Earn / Thu nhập**
     3. `circle` (`#8B5CF6` Lavender Amethyst) = **Borrow & Lend / Vay & Trả**
     4. `diamond` (`#0D9488` Teal Rhombus) = **Transfer / Chuyển khoản**
     5. `arch` (`#FFB703` Honey Marigold) = **Savings & Goals / Tiết kiệm**
     6. `hexagon` (`#3B82F6` Cobalt Blue) = **Bank & Recurring Bills / Ngân hàng & Định kỳ**
     7. `pentagon` (`#F472B6` Flamingo Rose) = **Credit Card & Installments / Thẻ tín dụng & Trả góp**
     8. `rainbow` (`#FB7185` Blossom Coral) = **Rewards, Gifts & Cashback / Tự thưởng & Hoàn tiền**
   - **Tailwind CSS v4 Source Scanning:** Any stylesheet in a subdirectory (such as `src/shared/theme/tokens.css`) MUST declare `@source '../../';` and `@source '../../../index.html';` immediately after `@import 'tailwindcss';`.

5. **Latest Stable Dependencies & Zero Deprecated Packages**
   - Maintain strict TypeScript (`strict: true`, `noImplicitAny: true`, no `any`).
   - Avoid deprecated third-party chart wrappers; use accessible, lightweight Pure SVG components for financial charts.

6. **Multi-Language (i18n) Architecture (`en` Default + `vi` Supported)**
   - Always support multi-language (`SupportedLocale = 'en' | 'vi'`), with **English (`'en'`) as the default language**.
   - Both `src/shared/i18n/en.ts` and `src/shared/i18n/vi.ts` must conform to the same strict `TranslationDictionary` TypeScript interface so missing keys fail at compile time.
   - Never hardcode raw text in UI components; always consume strings via `useTranslation()` (`const { t, locale, setLocale } = useTranslation()`).

