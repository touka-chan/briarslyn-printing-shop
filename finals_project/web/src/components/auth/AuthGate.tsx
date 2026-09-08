"use client";

/**
 * AuthGate — wraps the app's `{children}`. Redirects to `/login` when
 * signed out, shows a centered spinner while the auth state is loading,
 * and surfaces a "Profile not found" message if the user has no Firestore
 * `users/{uid}` doc.
 */
import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isAuthCreateInProgress } from "@/lib/auth-guard";
import { AlertTriangle, Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { firebaseUser, user, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !firebaseUser && pathname !== "/login") {
      // Skip the redirect when the Add Employee flow has just swapped
      // the SDK session via createUserWithEmailAndPassword. The
      // brief null state is intentional — the re-sign-in modal on
      // /employees handles restoring the admin's session. If we
      // redirect to /login here, the admin gets kicked out before
      // that modal can render.
      if (isAuthCreateInProgress()) {
        console.log("[AuthGate] redirect skipped — create in progress");
        return;
      }
      console.log("[AuthGate] REDIRECTING TO /LOGIN. firebaseUser:", firebaseUser, "user:", user, "loading:", loading);
      // `replace` so the protected URL doesn't end up in browser history.
      // No state to set here — the redirect itself is the state change.
      router.replace("/login");
    }
  }, [loading, firebaseUser, pathname, router]);

  if (pathname === "/login") return <>{children}</>;

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
        title="Loading…"
        body="Checking your session."
        tone="loading"
      />
    );
  }

  if (!firebaseUser) {
    // Signed out + not on /login. Normally the effect above will
    // replace the URL with /login, but during the Add Employee
    // create flow we deliberately skip that redirect — the
    // /employees page owns its own re-sign-in modal and the admin
    // needs to see it. Render the children unchanged so the page
    // tree (and the modal) stays mounted.
    if (isAuthCreateInProgress()) {
      return <>{children}</>;
    }
    // Render nothing (no spinner) so we don't loop on this view or
    // flash a "Signing you in…" message at a user who just signed out.
    return null;
  }

  if (firebaseUser && !user) {
    // Same as above: the new account's users/{uid} doc may not exist
    // for a few ms after createUserWithEmailAndPassword. The page is
    // about to show the re-sign-in modal — don't replace the children
    // with a "Profile not found" card in the meantime.
    if (isAuthCreateInProgress()) {
      return <>{children}</>;
    }
    return (
      <CenteredMessage
        title="Profile not found"
        body={`Your account (${firebaseUser.email}) is signed in, but the PrintFlow team hasn't added your profile to the database yet. Ask the admin to create a users/{uid} doc with your role, then refresh.`}
        tone="warning"
      />
    );
  }

  return <>{children}</>;
}

function CenteredMessage({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "loading" | "warning";
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
      </div>
    </div>
  );
}
