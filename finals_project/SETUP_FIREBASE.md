# PrintFlow — Firebase Backend Setup

This project is wired for **Firebase Authentication + Cloud Firestore**.
The web dashboard and the mobile POS share the same Firestore database,
so an order created in the cashier app appears on the web admin within ~1 s.

You create the project once; the code in this repo is the implementation.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com>.
2. **Add project** → use the existing project `brialyns-art-sign-services`
   (the firebase_adminsdk service account you already have belongs to
   this project). If you haven't created one yet, **Add project** with
   this name.
3. Disable Google Analytics (not needed for this scope).
4. Wait for the project to be created.

## 2. Enable Email/Password sign-in

1. In the left rail, **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → Enable → Save.
3. (Optional) Add yourself as a user under the **Users** tab so you can sign
   in to the web dashboard. The mobile app uses the same account.

## 3. Create the Cloud Firestore database

1. **Build → Firestore Database → Create database**.
2. Choose **Production mode** (the rules file in this repo will tighten it).
3. Pick a region close to the Philippines — **asia-southeast1 (Singapore)**.

## 4. Add a Web app

1. **Project settings (⚙️) → General → Your apps → Web** (`</>` icon).
2. Register the app as `PrintFlow Web`.
3. Copy the `firebaseConfig` object. In `web/`, create the env file:

   ```bash
   cp web/.env.local.example web/.env.local
   ```

4. Paste the values into `web/.env.local` (do **not** commit this file —
   it is gitignored). The values that need filling in are:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
   NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123def456
   ```

   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` are already pre-filled in
   `.env.local.example` and don't need to be changed.

5. Test: `cd web && npm run dev`, visit `http://localhost:3000`. You
   should be redirected to `/login`.

## 5. Add an Android app + iOS app (for the mobile POS)

> The mobile app is built with Flutter, which uses `flutterfire configure` to
> generate the native config files in one step.

1. **Project settings → Your apps → Android** — register the app using the
   Android package name from `mobile_app/android/app/build.gradle.kts`
   (currently `com.printflow.printflow_mobile`).
2. Repeat for **iOS** with the bundle id from `mobile_app/ios/Runner.xcodeproj`
   (currently `com.printflow.printflowMobile` — change it before publishing).
3. Install the FlutterFire CLI:

   ```bash
   dart pub global activate flutterfire_cli
   ```

4. From `mobile_app/`, run:

   ```bash
   flutterfire configure --project=brialyns-art-sign-services
   ```

   This will overwrite the placeholder files in this repo with real values:
   - `mobile_app/lib/firebase_options.dart`
   - `mobile_app/android/app/google-services.json`
   - `mobile_app/ios/Runner/GoogleService-Info.plist`

## 6. Deploy the Firestore security rules + index

```bash
npm install -g firebase-tools
firebase login
# .firebaserc already points to brialyns-art-sign-services, so no
# `firebase use --add` is needed.
firebase deploy --only firestore:rules,firestore:indexes
```

The rules in `firestore.rules` (at the repo root) enforce:
- Only signed-in users can read.
- `users/{uid}` is writable by the user themselves, or by Owner/Admin.
- `orders`, `inventory`, `sensors` are writable by the appropriate roles
  (see the file for the full matrix).
- `rfid_events` is **service-account-only** — only your future ESP32
  firmware (with a service-account key) can write check-out events. No
  user can fake a check-out.

## 7. (Optional) Seed the first user doc

After your first sign-in, the mobile/web `AuthService` will write a
`users/{uid}` doc with `role: "POS_Cashier"` as a default. To promote
yourself to Owner:

1. Open the Firebase console → **Firestore → users → {your uid}**.
2. Change the `role` field from `"POS_Cashier"` to `"Owner"`.
3. Sign out and back in — the role chip in the UI updates.

## 8. (Future) Wire the ESP32 RFID station

The `rfid_events` collection is already shaped for the ESP32 firmware.
When the hardware arrives:

> **Before you do this step, rotate the service account key.** The first
> key was shared in chat and must be treated as compromised. See
> `SECURITY.md` §"What to do if the service account key is leaked" for
> the rotation procedure. Only use the new JSON on the ESP32.

1. Firebase console → **Project settings → Service accounts → Generate new
   private key**. Save the JSON key on the ESP32's SD card.
2. Use the ESP32's `HTTPClient` to call
   `https://firestore.googleapis.com/v1/projects/brialyns-art-sign-services/databases/(default)/documents/rfid_events`
   with a `POST` body shaped like:

   ```json
   {
     "fields": {
       "materialVariantId": { "stringValue": "INV-1001" },
       "tagUid":            { "stringValue": "04A1B2C3D4" },
       "sensorId":          { "stringValue": "ESP32-01" },
       "timestamp":         { "timestampValue": "2026-09-04T10:30:00Z" },
       "source":            { "stringValue": "esp32" }
     }
   }
   ```

3. The mobile sensor screen and the web dashboard's RFID feed update
   within ~1 s — no other code changes needed.

---

## Verification

After setup, both halves of the system should:

- Show a **clean empty state** on every list page (no orders, no inventory,
  no activity) until the first doc is created.
- Allow you to sign in on the web → redirected to `/dashboard`.
- Allow you to sign in on the mobile POS → lands on the role-specific home
  screen.
- Reflect writes from one side in the other within ~1 s.

If any list shows a "stuck on loading" spinner, open the browser console
or `flutter logs` and look for permission-denied errors. The most common
cause is a missing `users/{uid}` doc — see step 7.

---

## 9. Deploy the web dashboard to Firebase Hosting

The Next.js app is configured for static export (`output: "export"` in
`web/next.config.ts`). Each `next build` produces a `web/out/` folder
of static HTML/JS/CSS, and `firebase.json` is wired to upload that
folder to Firebase Hosting.

### One-time: install the Firebase CLI

```bash
npm install -g firebase-tools
firebase login                      # opens browser, sign in once
```

### Deploy the backend first (rules + indexes)

```bash
cd finals_project                   # the repo root
firebase deploy --only firestore:rules,firestore:indexes
```

You should see `+ firestore: released rules` and `+ firestore: released
indexes` in the output. Open the Firebase console → **Firestore → Rules**
to confirm the rules match `firestore.rules`.

> **Note on `firestore.indexes.json`:** Firestore auto-creates single-field
> indexes for every field in every collection. You only need to declare
> **composite** indexes (e.g. `priority DESC + targetDate ASC`). If you
> try to deploy a single-field index, the CLI returns:
> `HTTP Error: 400, this index is not necessary, configure using single
> field index controls`. Just remove it from `firestore.indexes.json` and
> redeploy.

### Build the web app

```bash
cd web
npm install                         # if you haven't yet
npm run build                       # produces web/out/
```

Verify: `web/out/index.html` and `web/out/dashboard/index.html` should
both exist. If `next build` complains about `next/image`, ignore it —
the codebase doesn't use `<Image>` and `images: { unoptimized: true }` in
`next.config.ts` silences the warning.

### Deploy to Firebase Hosting

```bash
cd ..                               # back to the project root
firebase deploy --only hosting
```

The first run may prompt you to **create a hosting site**. Accept the
default name `brialyns-art-sign-services` — this becomes your public URL:

```
✔  hosting[brialyns-art-sign-services]: release complete
URL: https://brialyns-art-sign-services.web.app
```

Open that URL in a private/incognito window. You should be redirected
to `/login/`. Sign in with the user you created in step 2, and you
should land on `/dashboard/`.

**Hard refresh test:** refresh the page on `/dashboard/`, `/orders/`,
`/inventory/`, etc. — none of them should 404. (The SPA rewrite in
`firebase.json` + `trailingSlash: true` in `next.config.ts` makes this
work.)

### Re-deploy after changes

```bash
cd web && npm run build              # rebuild
cd .. && firebase deploy --only hosting
```

That's the whole loop.

---

## 10. Build the Flutter mobile POS (debug APK)

The mobile app is a Flutter project. For an academic demo, you don't
need to publish to the Play Store — a **debug APK** is enough to install
on a phone and verify the shared-database integration with the web.

### Prerequisites

```bash
flutter doctor                       # should be all green ✓
```

If `flutter doctor` reports missing Android SDK or Java 17, install them
first. The build needs:
- Flutter SDK (already in this repo's toolchain)
- Android SDK + platform-tools
- Java 17 (matches `mobile_app/android/app/build.gradle.kts`)

### Fill in the Firebase config (one-time)

```bash
cd finals_project/mobile_app
dart pub global activate flutterfire_cli
flutterfire configure --project=brialyns-art-sign-services
```

This **overwrites** the placeholder files in the repo with real values:
- `lib/firebase_options.dart` (committed — only contains public config)
- `android/app/google-services.json` (gitignored — contains public config)
- `ios/Runner/GoogleService-Info.plist` (gitignored, iOS only)

`flutterfire configure` will ask you which platforms to configure — pick
**Android** at minimum. iOS is optional for an Android-only build.

If you skipped step 1 and haven't created the Android app in the Firebase
console yet, `flutterfire configure` will create it for you automatically
using the package name `com.printflow.printflow_mobile` from
`android/app/build.gradle.kts`.

### Build the debug APK

```bash
flutter pub get
flutter build apk --debug
```

Output:
```
✓ Built build/app/outputs/flutter-apk/app-debug.apk (XX.X MB)
```

### Install on your phone

**Option A — USB cable (fastest):**

1. On the phone, enable **Developer options → USB debugging** (Settings →
   About phone → tap "Build number" 7 times, then go back to find
   Developer options).
2. Connect the phone via USB. The phone may show a "Allow USB debugging"
   prompt — tap Allow.
3. From the laptop:
   ```bash
   adb install -r build/app/outputs/flutter-apk/app-debug.apk
   ```

**Option B — Wireless transfer:**

1. Upload the APK to Google Drive / WhatsApp / email.
2. Open it on the phone, accept "Install from unknown source" once.
3. The PrintFlow app appears in your app drawer.

### Smoke test the shared database

This is the moment of truth — verifies the web and mobile are wired to
the **same Firestore database**:

1. **Web (browser):** open `https://brialyns-art-sign-services.web.app/orders/`
   — should show the empty state.
2. **Mobile (phone):** open the PrintFlow app, sign in with the same
   Firebase Auth user (or a different one — both work as long as they
   have a `users/{uid}.role` doc).
3. **Mobile:** create a new order from the cashier flow.
4. **Web:** within ~1 s, the order appears in the `/orders/` list.
5. **Web:** change the order's status to "In Production".
6. **Mobile:** the production staff's queue reflects the new status
   within ~1 s.

If step 4 fails with "permission denied", the most common causes are:
- You haven't deployed the Firestore rules yet (run step 9's first command).
- The mobile's `firebase_options.dart` is still showing `REPLACE_ME` values
  (re-run `flutterfire configure`).

---

## That's it

You now have:
- ✅ Web dashboard at `https://brialyns-art-sign-services.web.app`
- ✅ Firestore rules + indexes deployed
- ✅ Flutter mobile POS installed on your phone
- ✅ Both halves talking to the same database in real time

