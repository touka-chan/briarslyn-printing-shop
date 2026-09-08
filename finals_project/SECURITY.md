# SECURITY

PrintFlow uses Firebase Authentication + Cloud Firestore. The project is
`brialyns-art-sign-services`. This document describes which credentials are
safe to commit, which are not, where each one belongs, and how to handle
compromise.

---

## TL;DR

| Credential | Safe to commit? | Where it lives |
|---|---|---|
| **Web app `firebaseConfig`** (apiKey, authDomain, projectId, appId, etc.) | ✅ Yes (public by design) | `web/.env.local` (gitignored) — the *example* version is in `.env.local.example` |
| **Android / iOS `google-services.json` / `GoogleService-Info.plist`** | ✅ Yes (public by design) | `mobile_app/android/app/` and `mobile_app/ios/Runner/` (gitignored) — replaced by `flutterfire configure` |
| **Firebase Admin SDK service account JSON** (`private_key`, `client_email`) | ❌ **NEVER** | ESP32 firmware `secrets.h` (gitignored), CI secrets, or local password manager — **not in this repo** |
| **User passwords / Auth tokens** | ❌ **NEVER** | Only inside Firebase Auth — never logged, never sent to the web client |

The web bundle **must not** contain a service account key. The mobile bundle
**must not** contain a service account key. The service account key only ever
exists on a server (Cloud Function, CI runner) or on a trusted IoT device
(the ESP32, when it ships).

---

## Why the web `apiKey` is public

The `NEXT_PUBLIC_FIREBASE_API_KEY` in `web/.env.local` looks scary but is
**designed to be public**. Next.js ships it to the browser. Firebase itself
documents this: https://firebase.google.com/docs/projects/api-keys

What keeps data safe is the **Firestore Security Rules** in
`firestore.rules` at the project root. Those rules check
`request.auth.uid` and the user's role before allowing any read or write.
A leaked `apiKey` only lets someone make requests — the rules still deny
them.

What you should never expose is the **service account** `private_key`. That
key bypasses the rules entirely because it authenticates as a project
administrator, not as a regular user.

---

## Service account usage (for the future ESP32)

When the ESP32 RC522 RFID station is online, its firmware will write to the
`rfid_events` collection every time a tag is scanned. The rules in
`firestore.rules` deliberately deny this write to ordinary users — only the
service account (or a Cloud Function it calls) can create events. This is
what makes RFID events trustworthy: a cashier can't fake a check-out.

**To get a service account key for the ESP32:**

1. Firebase console → ⚙️ Project Settings → **Service Accounts** tab
2. Click **"Generate new private key"** (this creates a fresh JSON file
   with a `private_key` field)
3. The JSON file lands on your local disk — keep it there
4. **Place the JSON on the ESP32's flash** (or its LittleFS partition), but
   **never** in this git repo
5. Or, in firmware, define the values directly in `secrets.h` (which is
   `.gitignore`'d in the firmware project)

**Alternative path (no key on device):** Have the ESP32 POST to a Cloud
Function HTTPS endpoint, and have the Cloud Function (which uses the
service account server-side) write to `rfid_events`. The key then only
exists on Google's infrastructure. This is the more secure path for a
production deployment.

---

## What to do if the service account key is leaked

If a service account JSON ever ends up in a git commit, a chat transcript,
a CI log, an artifact, or a public bucket, treat it as compromised **even
if you deleted it from view**. Anyone who has a copy still has access until
you rotate the key.

**Rotation procedure:**

1. Firebase console → ⚙️ Project Settings → **Service Accounts** tab
2. Either:
   - On the existing service account, click **"Generate new private key"**
     (this invalidates the previous JSON), OR
   - Create a new service account with the same IAM roles and delete the
     old one
3. Update every place the old key was used (ESP32 firmware, Cloud Function
   env vars, CI secrets) to use the new JSON
4. The old key is now useless — no further cleanup needed
5. **If the key was in a git commit**, the rotation is mandatory because
   git history preserves the blob forever. Even after deletion from HEAD,
   `git log -p` and GitHub's "view commit" UI will show it
6. **If the key was in a public artifact or CDN bundle**, rotate
   immediately and add the JSON's SHA-256 hash to your monitoring/alerts

---

## Email/Password Auth + role on `users/{uid}`

- Users sign in with Firebase Auth (email + password)
- Each user's role lives in `users/{uid}.role` (one of
  `Owner | Admin | POS_Cashier | Production Staff`)
- The role is read on the client after sign-in and used to gate UI
- **For a production deployment**, the role should be enforced by Cloud
  Functions + custom claims, not just by the client. The current setup is
  "client reads its own role" which is fine for a demo but **not** for a
  live system where someone might tamper with the client
- Hardening (custom claims, Cloud Function `onCreate` to set role, etc.)
  is documented in `SETUP_FIREBASE.md` under "Production hardening"

---

## Firestore rules — the actual security boundary

The rules in `firestore.rules` are the only thing that protects user data
from a determined attacker. They enforce:

- `users/{uid}` — read by any signed-in user; write by self or Admin/Owner
- `orders/{id}` — read by any signed-in user; create/update by
  `POS_Cashier | Owner | Admin`; status update also by `Production Staff`
- `inventory/{id}` — read by any signed-in user; write by
  `Production Staff | Owner | Admin`
- `rfid_events/{id}` — read by any signed-in user; **create only by
  service account** (the rule denies ordinary user `create` calls)

**Deploy the rules** after every change:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

**Test the rules** before relying on them — Firebase has an emulator:
```bash
firebase emulators:start --only firestore
```

---

## What is in the repo right now

- ✅ `firestore.rules` — the security boundary, deploys via `firebase deploy`
- ✅ `firestore.indexes.json` — composite index on orders
- ✅ `firebase.json` — points at the rules + indexes
- ✅ `.firebaserc` — points at project `brialyns-art-sign-services`
- ✅ `web/.env.local.example` — public web config template, no secrets
- ✅ `mobile_app/lib/firebase_options.dart` — placeholder, replaced by
  `flutterfire configure`
- ❌ No service account JSON is or ever will be in the repo
- ❌ No `google-services.json` or `GoogleService-Info.plist` is committed
  (FlutterFire generates them locally and they're gitignored by the CLI)
- ❌ No `web/.env.local` is committed (gitignored by Next.js scaffold)

---

## Reporting a security issue

This is a Title 1 academic project for Brialyns Art Sign. For any real
security concern with a live deployment, contact the project owner directly.
For Firebase-platform issues, see:
https://firebase.google.com/support/troubleshooter/contact
