/**
 * Firebase Web SDK bootstrap — the single import point for Firebase in the
 * web app. Reads `process.env.NEXT_PUBLIC_FIREBASE_*` (set in `.env.local`),
 * initialises the app once, and exports the two clients every page needs.
 *
 * Pages must import `{ auth, db }` from this file, never from `firebase/app`
 * directly. The lazy-init guard avoids "Firebase App named '[DEFAULT]' already
 * exists" on Next.js HMR reloads in dev.
 */
import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

const app: FirebaseApp | null = isConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseReady = isConfigured;
export const firebaseApp = app;
export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

/**
 * Helper for service files. Throws a clear error when called before the env
 * vars are set, instead of the cryptic "Cannot read property of undefined"
 * the SDK would otherwise throw.
 */
export function requireDb(): Firestore {
  if (!db) {
    throw new Error(
      "Firebase is not configured. Copy web/.env.local.example to " +
        "web/.env.local and fill in the NEXT_PUBLIC_FIREBASE_* values " +
        "from your Firebase project (see SETUP_FIREBASE.md).",
    );
  }
  return db;
}

export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      "Firebase Auth is not configured. See SETUP_FIREBASE.md.",
    );
  }
  return auth;
}
