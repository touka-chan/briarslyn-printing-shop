# PrintFlow Mobile POS

Part of **PrintFlow** — *"An Integrated Mobile Point-of-Sale, IoT-Based Inventory Monitoring, and Order-Workflow System for Custom Printing Businesses."* (Title 1, approved.)

This is the **mobile half** of the system: a Flutter app that runs on the cashier's and production staff's Android / iOS devices. The web admin dashboard lives at `../web/`.

## What this app does

- **Cashier flow** — Take a new order with a PSGC-cascaded Philippine address, choose a payment method (Cash / E-Wallets / Bank Transfer), and watch the order land in the queue with the right priority.
- **Production flow** — See the day's queue with Overdue / Urgent / Upcoming priority chips, transition jobs through `Pending → In Production → Ready for Pickup → Completed`.
- **RFID sensor** — Live view of the ESP32 check-out station, with simulated activity for the demo (the production team can swap in real hardware without changing this screen).

## Roles

Three roles only — Admin / Owner, POS Cashier, Production Staff. Role-based routing in `lib/auth/`.

## Run it

```bash
flutter pub get
flutter run                # any connected device / simulator
flutter analyze
```

## Repo layout

- `lib/main.dart` — entry point
- `lib/app.dart` — MaterialApp + theme + role-based shell
- `lib/screens/` — Cashier, Production, Auth shells
- `lib/widgets/` — Shared widgets (address cascade, etc.)
- `lib/services/` — Inventory / order services (in-memory, with optimistic updates)
- `lib/models/` — Domain types (mirrors `web/src/types/`)
- `lib/theme/app_theme.dart` — Material 3 palette + component themes
- `lib/design/tokens.dart` — Spacing / radius / motion / type tokens
- `lib/utils/mock_data.dart` — In-memory mock data (orders, inventory, RFID events)

The full project README is at `../README.md`.
