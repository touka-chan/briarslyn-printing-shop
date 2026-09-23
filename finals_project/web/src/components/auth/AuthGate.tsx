"use client";

/**
 * AuthGate - wraps the app's `{children}`. Redirects to `/login` when
 * signed out, shows a centered spinner while the auth state is loading,
 * blocks `inactive` accounts until an Owner activates them, and surfaces
 * a "Profile not found" message if the profile doc is still missing
 * (auto-provision normally creates a pending one on sign-in).
 */
import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, isWebAllowedRole, WEB_RESTRICTED_MESSAGE, INACTIVE_MESSAGE } from "@/lib/auth";
import { isAuthCreateInProgress } from "@/lib/auth-guard";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { firebaseUser, user, loading, configured, signOut } = useAuth();
  const router = useRouter();
  const rawPathname = usePathname();
  // `trailingSlash: true` in next.config + Firebase `cleanUrls` means the
  // login URL is `/login/` and `usePathname()` returns the trailing slash.
  // A strict `=== "/login"` check then misfires on the login page itself:
  // redirect loop + `return null` blank page. Normalize once and use it
  // for every check below.
  const pathname = rawPathname?.replace(/\/+$/, "") || "/";
  const isLogin = pathname === "/login";
  // Public pages that MUST render while signed out:
  //   - /login (the sign-in form itself)
  //   - /reset-password (the landing page of the password-reset email
  //     link - the user is by definition signed out when they open it)
  // Without this, the gate redirected the email link straight back to
  // /login, so the reset form never appeared.
  const isPublicPage = isLogin || pathname === "/reset-password";

  useEffect(() => {
    if (!loading && !firebaseUser && !isPublicPage) {
      // Skip the redirect when the Add Employee flow has just swapped
      // the SDK session via createUserWithEmailAndPassword. The
      // brief null state is intentional - the re-sign-in modal on
      // /employees handles restoring the admin's session. If we
      // redirect to /login here, the admin gets kicked out before
      // that modal can render.
      if (isAuthCreateInProgress()) {
        return;
      }
      // `replace` so the protected URL doesn't end up in browser history.
      // No state to set here - the redirect itself is the state change.
      router.replace("/login");
    }
  }, [loading, firebaseUser, user, pathname, isPublicPage, router]);

  if (isPublicPage) return <>{children}</>;

  if (!configured) {
    return (
      <CenteredMessage
        title="Firebase is not configured"
        body="Copy web/.env.local.example to web/.env.local and fill in the NEXT_PUBLIC_FIREBASE_* values from the Firebase console. See SETUP_FIREBASE.md for the full setup."
        tone="warning"
      />
    );
  }

  if (loading) {
    return (
      <CenteredMessage
        title="Loading..."
        body="Checking your session."
        tone="loading"
      />
    );
  }

  if (!firebaseUser) {
    // Signed out + not on /login. Normally the effect above will
    // replace the URL with /login, but during the Add Employee
    // create flow we deliberately skip that redirect - the
    // /employees page owns its own re-sign-in modal and the admin
    // needs to see it. Render the children unchanged so the page
    // tree (and the modal) stays mounted.
    if (isAuthCreateInProgress()) {
      return <>{children}</>;
    }
    // Render nothing (no spinner) so we don't loop on this view or
    // flash a "Signing you in..." message at a user who just signed out.
    return null;
  }

  if (firebaseUser && !user) {
    // Same as above: the new account's users/{uid} doc may not exist
    // for a few ms after createUserWithEmailAndPassword. The page is
    // about to show the re-sign-in modal - don't replace the children
    // with a "Profile not found" card in the meantime.
    if (isAuthCreateInProgress()) {
      return <>{children}</>;
    }
    return (
      <CenteredMessage
        title="Profile not found"
        body={`Your account (${firebaseUser.email}) is signed in, but no profile exists yet and one couldn't be created automatically. Ask the Owner to approve your account on the Users page, then refresh.`}
        tone="warning"
        action={<UidChip uid={firebaseUser.uid} />}
      />
    );
  }

  if (firebaseUser && user && user.status !== "active") {
    // Pending approval (auto-provisioned) or deactivated account.
    // Checked before the role gate so the message is accurate for
    // every role, including Owner/Admin. Never trigger during Add
    // Employee - same reasoning as the branches around it.
    if (isAuthCreateInProgress()) {
      return <>{children}</>;
    }
    return (
      <CenteredMessage
        title={user.status === "inactive" ? "Account pending approval" : "Account inactive"}
        body={`${INACTIVE_MESSAGE} (Signed in as ${user.email} - role: ${user.role}.)`}
        tone="warning"
        action={
          <div className="flex flex-col items-center gap-3">
            <UidChip uid={firebaseUser.uid} />
            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut();
                } finally {
                  router.replace("/login");
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-printflow-on-primary bg-printflow-primary rounded-lg hover:bg-printflow-primary-container focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:ring-offset-2 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" aria-hidden />
              Sign out
            </button>
          </div>
        }
      />
    );
  }

  if (firebaseUser && user && !isWebAllowedRole(user.role)) {
    // Defense-in-depth: signIn() already rejects Cashier/Production, but
    // a session persisted before this gate (or a role demoted to
    // Cashier/Production while signed in) would otherwise keep full web
    // access. Never trigger during Add Employee - the temp session IS the
    // new cashier/production account and /employees owns its re-sign-in
    // modal.
    if (isAuthCreateInProgress()) {
      return <>{children}</>;
    }
    return (
      <CenteredMessage
        title="Mobile-app account"
        body={`${WEB_RESTRICTED_MESSAGE} (Signed in as ${user.email} - role: ${user.role}.)`}
        tone="warning"
        action={
          <button
            type="button"
            onClick={async () => {
              try {
                await signOut();
              } finally {
                router.replace("/login");
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-printflow-on-primary bg-printflow-primary rounded-lg hover:bg-printflow-primary-container focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:ring-offset-2 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            Sign out
          </button>
        }
      />
    );
  }

  return <>{children}</>;
}

/** Small mono UID chip so the Owner can identify the account without the console. */
function UidChip({ uid }: { uid: string }) {
  return (
    <p className="font-mono text-[11px] text-printflow-on-surface-variant/80 break-all">
      UID: {uid}
    </p>
  );
}

function CenteredMessage({
  title,
  body,
  tone,
  action,
}: {
  title: string;
  body: string;
  tone: "loading" | "warning";
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-printflow-bg p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {tone === "loading" ? (
          <Loader2 className="w-10 h-10 mx-auto text-printflow-primary animate-spin" />
        ) : (
          <div className="w-12 h-12 mx-auto rounded-full bg-printflow-warning-container flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-printflow-warning" />
          </div>
        )}
        <h1 className="text-xl font-bold text-printflow-on-surface">
          {title}
        </h1>
        <p className="text-sm text-printflow-on-surface-variant leading-relaxed">
          {body}
        </p>
        {action ? <div className="pt-2 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
