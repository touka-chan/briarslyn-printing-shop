/**
 * Session timer - pure utility (no React, no Firebase).
 *
 * Owns three things only:
 *  1. The two localStorage keys that hold the expiry and the "keep me
 *     signed in" preference.
 *  2. Two `setTimeout` handles - one for the warning modal, one for the
 *     hard auto-logout.
 *  3. The `storage` event listener that keeps multiple open tabs in
 *     sync (signing out in one tab should immediately sign out the
 *     others; extending the session in one should not silently expire
 *     in another).
 *
 * Why a separate file: the logic here is pure JS so it can be unit-
 * tested in isolation, reused by the watcher component, and re-used
 * by any future route that needs to know "how long until this user
 * is logged out". React and Firebase stay out of it.
 *
 * NOTE: Firebase's own ID-token auto-refresh (1 hour) and persistence
 * (local / session / none) is handled by `browserLocalPersistence` in
 * `firebase.ts`. What THIS module controls is the *application-level*
 * session length: how long from sign-in we trust the user, regardless
 * of whether the Firebase token itself has been refreshed.
 */

const EXPIRY_KEY = "printflow-session-expiry";
const KEEP_KEY = "printflow-session-keep";

/** 10 hours. The default session length for any sign-in. */
export const SESSION_DEFAULT_MS = 10 * 60 * 60 * 1000;

/** 24 hours. Used when the "Keep me signed in" box is checked. */
export const SESSION_KEEP_SIGNED_IN_MS = 24 * 60 * 60 * 1000;

/**
 * How long before expiry the warning modal pops up. Two minutes
 * matches the "give a user enough time to react" guidance in the
 * common auth UX checklist, and is short enough that the countdown
 * shown in the modal isn't a chore to read.
 */
export const WARNING_BEFORE_MS = 2 * 60 * 1000;

export interface SessionTimers {
 /** Cancel both timers and the storage listener. */
 cancel: () => void;
}

/** Shape of the callbacks {@link startTimers} invokes. */
export interface SessionTimersCallbacks {
 /** Fires when the session is inside the warning window. */
 onWarning: () => void;
 /** Fires when the session has actually expired. */
 onExpire: () => void;
}

/* ------------------------------------------------------------------ *
 *  localStorage helpers - every read/write is wrapped because
 *  `localStorage` can throw (Safari private mode, Storage disabled,
 *  SSR), and we never want the timer subsystem to crash the app.
 * ------------------------------------------------------------------ */

function safeGet(key: string): string | null {
 if (typeof window === "undefined") return null;
 try {
  return window.localStorage.getItem(key);
 } catch {
  return null;
 }
}

function safeSet(key: string, value: string): void {
 if (typeof window === "undefined") return;
 try {
  window.localStorage.setItem(key, value);
 } catch {
  /* ignore */
 }
}

function safeRemove(key: string): void {
 if (typeof window === "undefined") return;
 try {
  window.localStorage.removeItem(key);
 } catch {
  /* ignore */
 }
}

/* ------------------------------------------------------------------ *
 *  Public API - read / write the session state.
 * ------------------------------------------------------------------ */

/**
 * Returns the absolute expiry timestamp (ms since epoch), or `null`
 * if no session is stored. Callers should treat `null` as "this
 * browser has no active session" and NOT as "expired".
 */
export function getStoredExpiry(): number | null {
 const raw = safeGet(EXPIRY_KEY);
 if (!raw) return null;
 const n = Number(raw);
 return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Stores an expiry. `ms` is a duration; the absolute timestamp is
 * computed here so the watcher never has to do math.
 */
export function setStoredExpiry(ms: number): void {
 const expiresAt = Date.now() + Math.max(0, ms);
 safeSet(EXPIRY_KEY, String(expiresAt));
}

export function clearStoredExpiry(): void {
 safeRemove(EXPIRY_KEY);
}

/** Returns the user's "Keep me signed in" preference, defaulting to false. */
export function getStoredKeepSignedIn(): boolean {
 return safeGet(KEEP_KEY) === "1";
}

export function setStoredKeepSignedIn(keep: boolean): void {
 safeSet(KEEP_KEY, keep ? "1" : "0");
}

/* ------------------------------------------------------------------ *
 *  Timers
 * ------------------------------------------------------------------ */

/**
 * Starts the warning + expiry timers for a given absolute expiry.
 *
 * - If `expiresAt` is already in the warning window when called,
 *   `onWarning` fires immediately (next tick).
 * - If `expiresAt` is already past, `onExpire` fires immediately.
 * - The returned `cancel()` is idempotent and safe to call from a
 *   React effect's cleanup.
 *
 * Also wires a `storage` listener so a sign-out or expiry-extension
 * in another tab pushes the current tab into the same state without
 * having to re-read localStorage on a polling timer.
 */
export function startTimers(
 expiresAt: number,
 callbacks: SessionTimersCallbacks,
): SessionTimers {
 let warningHandle: ReturnType<typeof setTimeout> | null = null;
 let expireHandle: ReturnType<typeof setTimeout> | null = null;
 let cancelled = false;

 const clearAll = () => {
  if (warningHandle !== null) {
   clearTimeout(warningHandle);
   warningHandle = null;
  }
  if (expireHandle !== null) {
   clearTimeout(expireHandle);
   expireHandle = null;
  }
 };

 const schedule = () => {
  if (cancelled) return;
  const msUntilExpire = expiresAt - Date.now();

  if (msUntilExpire <= 0) {
   callbacks.onExpire();
   return;
  }

  const msUntilWarning = msUntilExpire - WARNING_BEFORE_MS;
  if (msUntilWarning <= 0) {
   // Already inside the warning window - fire on the next tick so
   // the caller's state-setter runs in a fresh event-loop turn.
   warningHandle = setTimeout(() => {
    warningHandle = null;
    if (!cancelled) callbacks.onWarning();
   }, 0);
  } else {
   warningHandle = setTimeout(() => {
    warningHandle = null;
    if (!cancelled) callbacks.onWarning();
   }, msUntilWarning);
  }

  expireHandle = setTimeout(() => {
   expireHandle = null;
   if (!cancelled) callbacks.onExpire();
  }, msUntilExpire);
 };

 /**
  * Cross-tab sync. If another tab writes to the expiry key
  * (e.g. it signed out, or extended its session), we re-evaluate
  * our own timers. We don't fire callbacks directly from the
  * storage event because the OTHER tab already did; we just make
  * sure our timers match the new value.
  *
  * We only extend (never shorten) in response to another tab's
  * write, because the watcher's `onExpire` callback would fire
  * and sign the user out - and that would race with the other
  * tab's "just hit Stay" intent. If the new value is the same
  * as ours, no-op. If the new value is missing/invalid/already
  * past, let our existing timer handle it.
  */
 const onStorage = (e: StorageEvent) => {
  if (cancelled) return;
  if (e.key !== EXPIRY_KEY) return;
  const newRaw = e.newValue;
  if (!newRaw) return; // cleared in another tab; our own timer will expire
  const newExpiry = Number(newRaw);
  if (!Number.isFinite(newExpiry)) return;
  if (newExpiry <= Date.now()) return; // already past; our onExpire will run
  if (newExpiry <= expiresAt) return; // same or shorter; nothing to do
  // The other tab extended past us. Reset our timers to match.
  clearAll();
  const msUntilExpire = newExpiry - Date.now();
  if (msUntilExpire <= 0) {
   callbacks.onExpire();
   return;
  }
  const msUntilWarning = msUntilExpire - WARNING_BEFORE_MS;
  if (msUntilWarning <= 0) {
   warningHandle = setTimeout(() => {
    warningHandle = null;
    if (!cancelled) callbacks.onWarning();
   }, 0);
  } else {
   warningHandle = setTimeout(() => {
    warningHandle = null;
    if (!cancelled) callbacks.onWarning();
   }, msUntilWarning);
  }
  expireHandle = setTimeout(() => {
   expireHandle = null;
   if (!cancelled) callbacks.onExpire();
  }, msUntilExpire);
 };

 if (typeof window !== "undefined") {
  window.addEventListener("storage", onStorage);
 }

 schedule();

 return {
  cancel: () => {
   if (cancelled) return;
   cancelled = true;
   clearAll();
   if (typeof window !== "undefined") {
    window.removeEventListener("storage", onStorage);
   }
  },
 };
}
