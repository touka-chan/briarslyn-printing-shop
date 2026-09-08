# PrintFlow — Integrated Mobile POS, IoT Inventory, and Order-Workflow System

**Title 1 (Approved)** — *"An Integrated Mobile Point-of-Sale, IoT-Based Inventory Monitoring, and Order-Workflow System for Custom Printing Businesses."*

PrintFlow is a complete order-to-delivery platform for small-format custom print shops. It bundles a role-based mobile point-of-sale, an ESP32 RFID check-out station for material variants, and a web admin dashboard for analytics, inventory, and production oversight. The reference deployment targets **Brialyns Art Sign** (Jena Bersamina, Sta. Cruz, Laguna) — a single-shop custom print business — and the system's data shape, workflows, and copy mirror that operation.

---

## What's in the repo

| Path | What it is |
|------|------------|
| `mobile_app/` | Flutter 3.13.1 + Dart 3 mobile POS app (Material 3, Android / iOS targets) |
| `web/` | Next.js 16.3.3 (App Router) + React 19 + Tailwind v4 admin dashboard |
| `Address/` | PSGC (Philippine Standard Geographic Code) JSON used by the address cascade |
| `pubspec.yaml` | The Flutter app manifest — the same app is run from `mobile_app/` and the root |

The mobile app is the cashier's tool; the web dashboard is the owner / admin's tool. They share the same domain shape (orders, inventory, users, RFID events) and the same status / priority conventions, so the two halves of the system stay in sync.

---

## The two halves

### Mobile POS — `mobile_app/`
- **Role-based** — four roles: Owner, Admin, POS Cashier, Production Staff.
- **Cashier flow** — New Order screen with the PSGC address cascade, payment choice (Cash / E-Wallets / Bank Transfer), and a live order queue with priority chips.
- **Production flow** — Order queue with Overdue / Urgent / Upcoming priority, per-job status transitions (`Pending → In Production → Ready for Pickup → Completed`), RFID sensor view with a live activity feed subscribed from Firestore.
- **Firebase-backed** — Authentication and Cloud Firestore; the cashier's order and the production staff's status update are both writes to the same database the web dashboard reads.

Run from `mobile_app/`:

```bash
flutter pub get
flutter run                # any connected device / simulator
flutter analyze            # lint + type check
```

### Web Admin Dashboard — `web/`
- **Order monitoring** with priority, status, ETA (`backlog + job_complexity + capacity`), and CSV export.
- **Inventory** with Holt-Winters / Exponential-Smoothing reorder-point forecast, low-stock alerts, and per-variant RFID-tag binding.
- **Production** queue, sensor overview, and the RFID activity feed.
- **Analytics + Reports** — sales, throughput, low-stock, top items.
- **Users + Employees** — role management with the PSGC address cascade on Add / Edit.

Run from `web/`:

```bash
npm install
npm run dev                # http://localhost:3000
npm run build              # production build (verifies TS + lint)
npm run lint
```

---

## Approved scope (per the Title 1 proposal)

The 9 specific objectives from the approved proposal, mapped to the code:

1. **Role-based mobile POS** — `mobile_app/lib/auth/`, four roles, gated by the signed-in user's `users/{uid}.role` doc.
2. **Production queue with priority** — `lib/screens/cashier/cashier_queue.dart` and the priority derivation in `web/src/lib/services/derived.ts` and `mobile_app/lib/services/orders_helpers.dart`.
3. **Real-time order status** — status flow `Pending → In Production → Ready for Pickup → Completed`, surfaced in both halves via Firestore `onSnapshot` subscriptions.
4. **Inventory tracking** — `lib/models/inventory_item.dart` (mobile) ↔ `web/src/types/index.ts` (web), with `current_stock`, `reorder_point`, `status`, persisted in the `inventory` collection.
5. **Web admin dashboard** — `web/src/app/`, with a Firebase Auth login gate at `/login`.
6. **Analytics** — `web/src/app/analytics/page.tsx` and `web/src/app/reports/page.tsx`, driven from `subscribeOrders` / `subscribeInventory` aggregates.
7. **RFID check-out** — `lib/screens/production/production_sensor.dart` (mobile) + `web/src/app/inventory/page.tsx` (web), both reading the `rfid_events` collection. The collection is **service-account-only for writes** — the future ESP32 firmware will be the only writer; no user can fake a check-out. See `SECURITY.md` and `SETUP_FIREBASE.md` §8.
8. **Predictive ROP forecasting** — `forecasted_demand_next_7_days` + Holt-Winters / Exponential Smoothing flags in inventory data.
9. **Dynamic ETA** — `estimated_completion` and `based_on` chips on each order, computed `backlog + job_complexity + capacity`.

Locale: Brialyns Art Sign, Pagsawitan, Sta. Cruz, Laguna, Region IV-A (CALABARZON) — 4009.

---

## Design system

Both halves use a shared design language — deep teal primary, cream surface, semantic status tones — declared once in each platform's token file. No new colors, fonts, or icon families are introduced by the app code.

- **Mobile**: `mobile_app/lib/theme/app_theme.dart` (Material 3) + `mobile_app/lib/design/tokens.dart` (spacing / radius / motion / type).
- **Web**: `web/src/app/globals.css` (`@theme {}` block) + `web/src/components/ui/`.

Dark mode, reduced-motion, and a no-op `useToast()` fallback are wired so neither app breaks when a primitive is invoked outside its provider.

---

## Backend (Firebase)

Both halves are wired to **Firebase Authentication + Cloud Firestore** on
project `brialyns-art-sign-services`. Reads use `onSnapshot` subscriptions,
so a write from the mobile POS shows up on the web dashboard within ~1 s
and vice versa. The Firestore security rules in `firestore.rules` are the
actual security boundary — see the dedicated docs:

- `SETUP_FIREBASE.md` — how to create the project, enable Email/Password,
  create the Web / Android / iOS apps, deploy the rules, and (later) wire
  the ESP32.
- `SECURITY.md` — which credentials are safe to commit, why the web
  `apiKey` is public, how the ESP32 service-account key is handled, and
  what to do if it's ever leaked.

The service-account JSON for the project **must never** be committed,
pasted into a chat, or shipped in a web or mobile bundle. Rotate it via
the Firebase console if it ever leaks.

---

## Deployment

Once the Firebase project is set up (see `SETUP_FIREBASE.md`), the whole
system is one command away from being live:

| Layer | Where it lives | Deploy command |
|---|---|---|
| **Web dashboard** | Firebase Hosting, `https://brialyns-art-sign-services.web.app` | `cd web && npm run build && cd .. && firebase deploy --only hosting` |
| **Firestore rules + indexes** | Firebase project `brialyns-art-sign-services` | `firebase deploy --only firestore:rules,firestore:indexes` |
| **Mobile POS** | Local Android phone (debug APK) | `cd mobile_app && flutter build apk --debug && adb install -r build/app/outputs/flutter-apk/app-debug.apk` |

The web dashboard is a **static export** of Next.js (`output: "export"`
in `web/next.config.ts`), so Firebase Hosting serves it from a global
CDN with no server runtime. All data is fetched client-side from
Firestore via `onSnapshot` subscriptions, which means writes from the
mobile app appear on the web within ~1 s and vice versa — no extra
plumbing needed for the "shared database" requirement.

For full step-by-step instructions (including the Firebase console
setup and the mobile APK build), see **`SETUP_FIREBASE.md` §9 and §10**.

---

## Out of scope (deliberately)

- Real ESP32 firmware — the RFID station is **not yet** wired. The `rfid_events` collection, the security rules, and the mobile / web read paths are in place; only the firmware that writes to that collection is pending the hardware. See `SETUP_FIREBASE.md` §8 and `SECURITY.md` for the service-account story.
- Payment gateway integration — the cashier's payment choice is recorded on the order but not charged.
- Production hardening (custom claims, Cloud Functions for `onCreate`, App Check) — the current setup reads the role from `users/{uid}.role` on the client, which is fine for the demo but should be moved to custom claims before any live deployment. See `SECURITY.md`.
