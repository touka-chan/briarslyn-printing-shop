# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

> **Before writing any code, read `AGENTS.md`.** This project uses Next.js 16, which has breaking changes vs. earlier versions. The `node_modules/next/dist/docs/` directory is the source of truth for current App Router conventions — do not rely on training data alone.

---

## What this is

The **web admin dashboard** for **PrintFlow**, the Title 1 project for Brialyns Art Sign (Jena Bersamina, Sta. Cruz, Laguna): an integrated mobile POS + IoT inventory + order-workflow system. The mobile app is Flutter (separate scope) and the IoT sensor is an ESP32 RFID station; this repo is the Next.js admin only.

The dashboard currently runs against in-memory mock data — there is no real backend yet. Every visible value should be derived from `src/lib/mockData.ts`.

---

## Commands

All commands run from `web/`.

| Task | Command |
|------|---------|
| Dev server (http://localhost:3000) | `npm run dev` |
| Production build | `npm run build` |
| Run production build locally | `npm run start` |
| Lint (ESLint, `next/core-web-vitals` + TS rules) | `npm run lint` |

There is no test script — verification is the `npm run build` step and manual walk-throughs of the 9 Title 1 features.

---

## Architecture

**Stack.** Next.js 16.3.3 (App Router) + React 19.2.8 + TypeScript 5 (strict) + Tailwind v4 (via `@tailwindcss/postcss`, tokens declared inside `@theme {}` in `globals.css`) + `lucide-react` + `recharts` 3.10. Path alias `@/*` → `./src/*`.

**Routes** live under `src/app/<route>/page.tsx`:

- `/dashboard` `/orders` `/orders/[id]` `/inventory` `/inventory/[id]` `/production` `/forecasting` `/analytics` `/users` `/settings` `/reports`

Every page must:

1. Be a `"use client"` component.
2. Wrap its body in `<AdminLayout title=… subtitle=…>`.
3. Read its data from `@/lib/mockData` (or `@/types` for the domain shape).
4. Surface user-initiated state changes via `useToast()` (e.g. status change, PO queued, alert acknowledged).

**Shared UI** is composed, not re-implemented. Re-exports go through barrel files:

- `src/components/ui/index.ts` — `KpiCard`, `ContentCard`, `FilterToolbar`, `DataTable`, `StatusBadge`, `PriorityBadge`, `PaymentBadge`, `Button`, `Modal`, `Dropdown`, `EmptyState` (with `LoadingState`, `CardSkeleton`, `TableSkeleton`), `ChartCard`, `Icon`, `Skeleton`, `ToastProvider`, `useToast`.
- `src/components/layout/index.ts` — `Sidebar`, `MobileSidebarTrigger`, `MobileSidebarOverlay`, `Header`, `AdminLayout`.

If you find yourself re-writing a card, table row, badge, or modal in a page, stop — the primitive already exists.

**Toasts.** `AdminLayout` mounts `<ToastProvider>` once. `useToast()` returns `{ success, error, info }` and has a no-op fallback if called outside a provider — so it is safe to destructure in components that might be tested in isolation. Default duration is 4 s; the live region is ARIA `role="status"`.

**Domain types** are in `src/types/index.ts`: `Order`, `InventoryItem`, `ProductionJob`, `User`, `RfidCheckoutEvent`, `DashboardSummary`, `KpiData`, `FilterTab`, `TableColumn<T>`. Several interfaces carry compatibility aliases (e.g. `Order.id` ↔ `Order.order_id`) — prefer the new canonical name when adding fields; the aliases are there for legacy call sites.

**Mock data invariants** (in `src/lib/mockData.ts`):

- `TODAY` is pinned to `2026-08-20` so priority, ETA, and stale flags are deterministic across runs. Change `TODAY` here if the snapshot is rebuilt.
- Priority is derived from `target_date`: `Overdue` if `diffDays < 0`, `Urgent` if `≤ 2`, else `Upcoming`.
- ETA is `backlog + job_complexity + capacity → +1-3 days` based on priority.
- Inventory status: `current_stock ≤ reorder_point` → `Low Stock`; `≤ 60 %` of ROP → `Insufficient Stock`.
- RFID `isStale` flag: last checkout > 12 h ago.

---

## Design system

The PrintFlow M3 palette and type/spacing/shadow tokens are declared **once** in `src/app/globals.css` inside the `@theme {}` block. Use the existing `--color-printflow-*` tokens (cream `#fbf9f4` ground, deep teal `#00535b` primary, cyan `#82d3de`/`#9ff0fb` primary-fixed, crimson `#a8372c` secondary, blue `#00479b` tertiary, status tones for success/warning/error). Do not introduce new colors.

Type scale lives in the same file (`--font-display/headline/title/body/label/mono`). Use the Segoe UI stack already configured — no Google Fonts.

**Dark mode** is controlled by a `.dark` class on `<html>`. The inline bootstrap script in `src/app/layout.tsx` reads `localStorage.printflow-theme` and applies the class before paint to prevent flash. `<html>` carries `suppressHydrationWarning` for this reason.

**Motion.** Global keyframes (`modal-content`, `pulse-step`, `shimmer`, `slide-in-right`, `badge-pop`, etc.) are in `globals.css`. All non-essential motion is wrapped under a single `@media (prefers-reduced-motion: reduce) { … 0ms }` rule — do not add new animations without extending that block.

---

## Conventions to honor

- **No new colors, no new fonts, no new icon families.** `lucide-react` is the only icon set; never substitute emoji for an icon.
- **Single source of truth for badges.** Use `PriorityBadge` (Overdue/Urgent/Upcoming), `PaymentBadge` (Paid/Partial/Unpaid), `StatusBadge` (order + inventory variants). Don't inline a ternary pill that recreates one of these.
- **Layout chrome is `AdminLayout` only.** Don't re-implement sidebar + header inside a page.
- **All persistent state goes through `localStorage`** with `try/catch` — settings, theme. Nothing else.
- **`<html suppressHydrationWarning>`** is intentional. Don't remove it.
- **No new top-level files in `web/` root** other than the standard Next.js scaffold — Flutter leftovers (`index.html`, `manifest.json`, `favicon.png`, `icons/`) have already been cleaned out; do not re-introduce them.
