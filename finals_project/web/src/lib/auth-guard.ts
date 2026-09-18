/**
 * Auth-gate guard - lets the Add Employee flow opt out of AuthGate's
 * "signed out - /login" and "no profile doc - Profile not found"
 * branches for the brief moment between
 * `createUserWithEmailAndPassword` (which atomically swaps the SDK
 * session) and the admin re-authenticating themselves.
 *
 * Without this, AuthGate sees `firebaseUser = null` during the swap
 * and redirects to /login, kicking the admin out before the
 * re-sign-in modal can render. The same goes for the
 * `firebaseUser` of the freshly-created account: its `users/{uid}`
 * doc may not exist for a few ms, so AuthGate's "Profile not found"
 * path would also unmount the /employees tree.
 *
 * Module-level state, not React state, because AuthGate's effect
 * needs to read it on the same render that observes the auth change -
 * a useState in the page component can't be set in time.
 *
 * The flag is automatically cleared after a generous timeout so a
 * forgotten `endCreate()` (e.g. due to an exception in user code)
 * doesn't permanently lock the app out.
 */

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - well over any plausible create flow

let inProgress = false;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

export function beginAuthCreate(): void {
  inProgress = true;
  if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  // Fail-safe: if the caller forgets to end, restore normal
  // AuthGate behavior after a long timeout so the app doesn't
  // stay permanently "in create" mode.
  timeoutHandle = setTimeout(() => {
    inProgress = false;
    timeoutHandle = null;
  }, DEFAULT_TIMEOUT_MS);
}

export function endAuthCreate(): void {
  inProgress = false;
  if (timeoutHandle !== null) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
}

export function isAuthCreateInProgress(): boolean {
  return inProgress;
}
