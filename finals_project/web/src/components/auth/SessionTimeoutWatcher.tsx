"use client";

/**
 * SessionTimeoutWatcher — the brain of the application-level session
 * timer. Renders nothing; mounts the warning modal and triggers
 * auto-logout by calling `useAuth().signOut()`.
 *
 * Lifecycle:
 *  1. On mount, if the user is signed in, read the expiry from
 *     localStorage and start the warning + expire timers via
 *     `startTimers()` from `@/lib/session`.
 *  2. The `storage` event inside `startTimers` re-syncs the timers
 *     when another tab signs out or extends its own session.
 *  3. When the warning window is reached, this component shows
 *     the modal. "Stay signed in" writes a new full-duration
 *     expiry and re-arms the timers. "Sign out now" calls
 *     `signOut()` immediately.
 *  4. When the expire timer fires, this component calls
 *     `signOut()` and shows a "Session expired" toast on the
 *     next page.
 *
 * The watcher deliberately does NOT render any UI of its own —
 * it's a side-effect component. Wrapping it inside the
 * `<ToastProvider>` (already done in `layout.tsx`) gives it
 * access to the toast API for the expired-session message.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import {
  SESSION_DEFAULT_MS,
  SESSION_KEEP_SIGNED_IN_MS,
  getStoredExpiry,
  getStoredKeepSignedIn,
  setStoredExpiry,
  startTimers,
  type SessionTimers,
} from "@/lib/session";
import { SessionTimeoutModal } from "./SessionTimeoutModal";

export function SessionTimeoutWatcher() {
 const { firebaseUser, signOut } = useAuth();
 const router = useRouter();
 const toast = useToast();

 const [warningOpen, setWarningOpen] = useState(false);
 const [expiresAt, setExpiresAt] = useState<number | null>(null);

 // Hold the timer handle across re-renders so the cleanup effect
 // can cancel it when the user signs out or the component unmounts.
 const timersRef = useRef<SessionTimers | null>(null);
 // Track whether we already fired the "expired" toast this cycle,
 // so a fast follow-up render (e.g. firebaseUser flipping to null
 // after signOut) doesn't double-fire it.
 const expiredToastShownRef = useRef(false);

 const stopTimers = useCallback(() => {
  if (timersRef.current) {
   timersRef.current.cancel();
   timersRef.current = null;
  }
 }, []);

 const arm = useCallback(() => {
  stopTimers();
  const expiry = getStoredExpiry();
  if (!expiry) {
   // No expiry on disk — that means we have no active session.
   // Don't arm any timers; the next sign-in will write a fresh one.
   setWarningOpen(false);
   setExpiresAt(null);
   return;
  }
  setExpiresAt(expiry);
  expiredToastShownRef.current = false;
  timersRef.current = startTimers(expiry, {
   onWarning: () => {
    // Guard: don't open the modal if the user is no longer signed
    // in (e.g. another tab signed them out — the storage event
    // would have removed the expiry, but we double-check here).
    setWarningOpen(true);
   },
   onExpire: async () => {
    if (expiredToastShownRef.current) return;
    expiredToastShownRef.current = true;
    setWarningOpen(false);
    try {
     await signOut();
    } catch {
     /* ignore — we'll still navigate */
    } finally {
     // `replace` so the protected URL doesn't end up in browser
     // history. The toast survives the navigation because the
     // <ToastProvider> lives in the root layout.
     toast.info("You were signed out because your session expired.");
     router.replace("/login");
    }
   },
  });
 }, [router, signOut, stopTimers, toast]);

 // Re-arm when the user changes (sign-in / sign-out).
 useEffect(() => {
  if (!firebaseUser) {
   // Signed out — kill any timers and close the modal.
   stopTimers();
   setWarningOpen(false);
   setExpiresAt(null);
   return;
  }
  arm();
  return () => {
   // Cleanup on unmount only. The next arm() in the same effect
   // cycle will cancel + re-create the timers.
  };
 }, [firebaseUser, arm, stopTimers]);

 // Belt-and-braces: also listen for `storage` events at the
 // component level. The `startTimers()` helper already installs
 // its own storage listener to re-sync the timers, but we also
 // need to re-render our `expiresAt` state so the modal shows
 // the right countdown. (`startTimers` only mutates the JS-level
 // timers, not React state.)
 useEffect(() => {
  if (typeof window === "undefined") return;
  const onStorage = (e: StorageEvent) => {
   if (e.key !== "printflow-session-expiry") return;
   if (!firebaseUser) return;
   // Another tab changed the expiry — re-arm ourselves so our
   // React state and timers stay aligned.
   arm();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
 }, [arm, firebaseUser]);

 // Cleanup on unmount only.
 useEffect(() => {
  return () => {
   stopTimers();
  };
 }, [stopTimers]);

 const handleStay = useCallback(() => {
  // Re-write the expiry to the full duration, based on the
  // user's current "keep me signed in" preference. The
  // onAuthStateChanged in useAuth() does the same thing on a
  // hard reload, but here we're handling the "still in the tab,
  // just hit Stay" case.
  const keep = getStoredKeepSignedIn();
  setStoredExpiry(keep ? SESSION_KEEP_SIGNED_IN_MS : SESSION_DEFAULT_MS);
  setWarningOpen(false);
  // Re-arm with the new expiry.
  arm();
 }, [arm]);

 const handleSignOut = useCallback(async () => {
  setWarningOpen(false);
  try {
   await signOut();
  } finally {
   router.replace("/login");
  }
 }, [router, signOut]);

 return (
  <SessionTimeoutModal
   isOpen={warningOpen}
   expiresAt={expiresAt}
   onStay={handleStay}
   onSignOut={handleSignOut}
  />
 );
}
