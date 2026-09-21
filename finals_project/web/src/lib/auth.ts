/**
 * Auth hook - wraps Firebase Auth + the `users/{uid}` doc lookup so
 * pages can read `{ user, role, loading, signIn, signOut, error }` in one
 * line. Used by `<AuthGate>` and the sidebar/header role chip.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
 signInWithEmailAndPassword,
 signOut as fbSignOut,
 onAuthStateChanged,
 type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";
import type { User } from "@/types";
import { recordLogin } from "@/lib/services/users";
import { logAudit } from "@/lib/services/audit";
import {
  SESSION_DEFAULT_MS,
  SESSION_KEEP_SIGNED_IN_MS,
  clearStoredExpiry,
  getStoredExpiry,
  getStoredKeepSignedIn,
  setStoredExpiry,
  setStoredKeepSignedIn,
} from "@/lib/session";

/**
 * Web admin allowlist - Owner/Admin only. POS_Cashier and Production Staff
 * are mobile-app-only accounts and must be rejected at web sign-in (with
 * a defense-in-depth block in `<AuthGate>` for persisted sessions).
 */
export const WEB_ALLOWED_ROLES: ReadonlyArray<User["role"]> = ["Owner", "Admin"];

export const WEB_RESTRICTED_MESSAGE =
  "This account is for the mobile app only. Cashier and Production Staff can't sign in to the web admin - please use the mobile POS app, or ask the Owner for an Owner/Admin account.";

export function isWebAllowedRole(role: unknown): boolean {
  return role === "Owner" || role === "Admin";
}

export const INACTIVE_MESSAGE =
  "This account is pending approval (or was deactivated). Ask the Owner to activate it on the Users page, then sign in again.";

/**
 * Self-healing onboarding: when a Firebase Auth account has no
 * `users/{uid}` doc (console-created or orphaned account), create a
 * minimal profile so sign-in just works. Default `active` for zero
 * hassle - safe because Auth accounts only exist when an admin
 * creates them (no public sign-up); the Owner can still deactivate
 * anyone from the Users page. Rules allow self-create of your own doc.
 */
export async function provisionMissingProfile(
  uid: string,
  email: string | null,
  displayName: string | null,
): Promise<User | null> {
  if (!db) return null;
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return null; // someone else just created it - listener picks it up
    const name =
      displayName?.trim() ||
      (email?.includes("@") ? email.split("@")[0] : "") ||
      "Staff";
    const profile: User = {
      id: uid,
      uid,
      email: email ?? "",
      name,
      role: "POS_Cashier",
      status: "active",
    };
    await setDoc(ref, {
      email: profile.email,
      name: profile.name,
      role: profile.role,
      status: profile.status,
      address: null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      last_login_at: null,
    });
    return profile;
  } catch {
    // Offline / denied - caller falls back to "Profile not found".
    return null;
  }
}

export interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  role: User["role"] | null;
  loading: boolean;
  signIn: (email: string, password: string, keepSignedIn?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  /** True when Firebase is configured. False until `.env.local` is filled. */
  configured: boolean;
}

/**
 * Shared last-known auth snapshot (module scope, SPA lifetime).
 *
 * Every page renders its own AdminLayout, so Sidebar/Header remount on
 * every navigation and each `useAuth()` instance starts from its own
 * `useState(null)` + refetch - a null window that unmounts Owner-gated
 * nav items (Audit Log) and shifts the rest (Settings) on every page
 * change. New hook instances seed from this cache, so after the first
 * load there is no null window. The wrappers inside `useAuth` keep it
 * in sync; sign-out / web-restriction paths write null through the
 * same wrappers, clearing it.
 */
let lastKnownFirebaseUser: FirebaseUser | null = null;
let lastKnownUser: User | null = null;

export function useAuth(): AuthState {
  const [firebaseUser, setFirebaseUserState] =
    useState<FirebaseUser | null>(lastKnownFirebaseUser);
  const [user, setUserState] = useState<User | null>(lastKnownUser);
  const [loading, setLoading] = useState<boolean>(
    firebaseReady && !lastKnownUser,
  );
  const [error, setError] = useState<string | null>(null);

  // Wrappers keep the module-level snapshot in sync so a freshly
  // mounted hook (new Sidebar/Header on every page navigation) starts
  // from the last confirmed user instead of a null window that makes
  // Owner-gated nav items flicker. Sign-out / restriction paths set
  // null, which clears the cache through the same wrappers.
  const setFirebaseUser = (fb: FirebaseUser | null) => {
    lastKnownFirebaseUser = fb;
    setFirebaseUserState(fb);
  };
  const setUser = (u: User | null) => {
    lastKnownUser = u;
    setUserState(u);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fb) => {
      setFirebaseUser(fb);
      if (fb && db) {
        // Load the user doc to get the role + profile.
        const snap = await getDoc(doc(db, "users", fb.uid));
        if (snap.exists()) {
          const d = snap.data();
          setUser({
            id: fb.uid,
            uid: fb.uid,
            email: d.email ?? fb.email ?? "",
            name: d.name ?? "",
            role: d.role ?? "POS_Cashier",
            status: d.status ?? "active",
            address: d.address ?? undefined,
            lastLogin: d.last_login_at ?? undefined,
          });
        } else {
          // No profile doc - self-heal with a pending (inactive)
          // profile so the Owner can approve it in-app. Falls back
          // to "Profile not found" when the write fails.
          const provisioned = await provisionMissingProfile(
            fb.uid,
            fb.email,
            fb.displayName,
          );
          if (provisioned) {
            setUser(provisioned);
          } else {
            setUser(null);
          }
        }
        // Make sure there is always an expiry on disk while a user
        // is signed in. Firebase's `browserLocalPersistence` keeps
        // the *token* alive across reloads, but it does NOT
        // enforce an application-level session length - that's
        // what we do here. If the user reloaded the tab and we
        // somehow have a Firebase user but no expiry, give them
        // the default 10h window starting now.
        if (!getStoredExpiry()) {
          const keep = getStoredKeepSignedIn();
          setStoredExpiry(keep ? SESSION_KEEP_SIGNED_IN_MS : SESSION_DEFAULT_MS);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, keepSignedIn: boolean = true) => {
      setError(null);
      if (!auth) {
        setError(
          "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in web/.env.local.",
        );
        return;
      }
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // Role gate BEFORE recording login / persisting session: web admin
        // is Owner/Admin only. Cashier + Production Staff are mobile-only.
        // A missing users/{uid} doc falls through to AuthGate's
        // "Profile not found" screen (not blocked here).
        if (db) {
          try {
            const snap = await getDoc(doc(db, "users", cred.user.uid));
            if (snap.exists()) {
              const role = (snap.data() as { role?: unknown }).role;
              if (!isWebAllowedRole(role)) {
                // Kill the just-created Firebase session so no token
                // lingers for the blocked account on this browser.
                clearStoredExpiry();
                await fbSignOut(auth).catch(() => {
                  // ignore - session cleanup is best-effort
                });
                setFirebaseUser(null);
                setUser(null);
                setError(WEB_RESTRICTED_MESSAGE);
                const err = new Error(WEB_RESTRICTED_MESSAGE) as Error & {
                  code?: string;
                };
                err.code = "auth/web-restricted";
                throw err;
              }
            }
          } catch (e: unknown) {
            // Re-throw our own restriction error with its message intact.
            if ((e as { code?: string })?.code === "auth/web-restricted") throw e;
            // A failed role lookup (e.g. permission-denied on users/{uid})
            // must NOT lock the user out here - let AuthGate / the
            // profile screen handle it after sign-in completes.
          }
          await recordLogin(cred.user.uid).catch(() => {
            // ignore - user may not have a doc yet
          });
          logAudit({
           action: "user_login",
           module: "auth",
           record_id: cred.user.uid,
           record_label: `Login ${cred.user.email ?? cred.user.uid}`,
           old_value: null,
           new_value: "signed in",
          });
        }
        // Persist the keep-signed-in preference and the resulting
        // session length. The watcher reads these on the next
        // render to know when to show the warning modal and when
        // to hard-log-out.
        setStoredKeepSignedIn(keepSignedIn);
        setStoredExpiry(
          keepSignedIn ? SESSION_KEEP_SIGNED_IN_MS : SESSION_DEFAULT_MS,
        );
      } catch (e: unknown) {
        // Preserve our own restriction message; humanize the rest.
        if ((e as { code?: string })?.code !== "auth/web-restricted") {
          setError(humanizeAuthError(e));
        }
        throw e;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    clearStoredExpiry();
    if (!auth) return;
    // Log BEFORE signing out - afterwards there is no user to attribute.
    const who = auth.currentUser;
    if (who) {
     logAudit({
      action: "user_logout",
      module: "auth",
      record_id: who.uid,
      record_label: `Logout ${who.email ?? who.uid}`,
      old_value: "signed in",
      new_value: null,
     });
    }
    await fbSignOut(auth);
  }, []);

  return {
    user,
    firebaseUser,
    role: user?.role ?? null,
    loading,
    signIn,
    signOut,
    error,
    configured: firebaseReady,
  };
}

function humanizeAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/web-restricted") return WEB_RESTRICTED_MESSAGE;
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks off.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
