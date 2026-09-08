/**
 * Auth hook — wraps Firebase Auth + the `users/{uid}` doc lookup so
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
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseReady } from "@/lib/firebase";
import type { User } from "@/types";
import { recordLogin } from "@/lib/services/users";
import {
  SESSION_DEFAULT_MS,
  SESSION_KEEP_SIGNED_IN_MS,
  clearStoredExpiry,
  getStoredExpiry,
  getStoredKeepSignedIn,
  setStoredExpiry,
  setStoredKeepSignedIn,
} from "@/lib/session";

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

export function useAuth(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseReady);
  const [error, setError] = useState<string | null>(null);

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
          // Signed in but no profile doc yet — show "Profile not found".
          setUser(null);
        }
        // Make sure there is always an expiry on disk while a user
        // is signed in. Firebase's `browserLocalPersistence` keeps
        // the *token* alive across reloads, but it does NOT
        // enforce an application-level session length — that's
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
        if (db) {
          await recordLogin(cred.user.uid).catch(() => {
            // ignore — user may not have a doc yet
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
        setError(humanizeAuthError(e));
        throw e;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    clearStoredExpiry();
    if (!auth) return;
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
