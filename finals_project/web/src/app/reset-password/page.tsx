"use client";

/**
 * Password-reset landing page — the destination of the Gmail reset link.
 *
 * Firebase appends ?mode=resetPassword&oobCode=... to this URL. We read
 * the query client-side (no useSearchParams, so static export stays
 * happy), verify the code to reveal the account email, then let the user
 * set a new password + confirm (with eye toggles) via
 * confirmPasswordReset.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui";

type Status = "loading" | "ready" | "done" | "error";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setFatal("Firebase is not configured.");
      setStatus("error");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");
    if (mode !== "resetPassword" || !oobCode) {
      setFatal("This reset link is invalid. Request a new one from the login page.");
      setStatus("error");
      return;
    }
    setCode(oobCode);
    verifyPasswordResetCode(auth, oobCode)
      .then((accountEmail) => {
        setEmail(accountEmail);
        setStatus("ready");
      })
      .catch(() => {
        setFatal(
          "This reset link is expired or already used. Request a new one from the login page.",
        );
        setStatus("error");
      });
  }, []);

  const handleSubmit = async () => {
    setFormError(null);
    if (pwNew.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!auth || !code) {
      setFormError("Reset session expired. Request a new link.");
      return;
    }
    setSaving(true);
    try {
      await confirmPasswordReset(auth, code, pwNew);
      setStatus("done");
    } catch {
      setFormError(
        "This link is expired or already used. Request a new one from the login page.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent";
  const toggleCls =
    "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-printflow-on-surface-variant hover:text-printflow-on-surface";

  return (
    <div className="min-h-screen flex items-center justify-center bg-printflow-bg px-4 py-10">
      <div className="w-full max-w-md bg-printflow-surface rounded-2xl border border-printflow-outline-variant/40 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="w-8 h-8 text-printflow-primary animate-spin" />
            <p className="text-sm text-printflow-on-surface-variant">
              Verifying your reset link…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-printflow-error/10">
              <AlertTriangle className="w-7 h-7 text-printflow-error" />
            </span>
            <h1 className="text-xl font-bold text-printflow-on-surface">
              Link problem
            </h1>
            <p className="text-sm text-printflow-on-surface-variant">{fatal}</p>
            <Link href="/login" className="mt-2">
              <Button variant="primary">Back to login</Button>
            </Link>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-printflow-primary-fixed">
                <KeyRound className="w-7 h-7 text-printflow-primary" />
              </span>
              <h1 className="text-xl font-bold text-printflow-on-surface">
                Choose a new password
              </h1>
              <p className="text-sm text-printflow-on-surface-variant">
                For <span className="font-medium">{email}</span>
              </p>
            </div>
            <div className="space-y-4 mt-6">
              {formError && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
                >
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className={toggleCls}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat the password"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className={toggleCls}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => void handleSubmit()}
                className="w-full py-3"
                loading={saving}
                disabled={saving}
              >
                {saving ? "Updating…" : "Set new password"}
              </Button>
            </div>
          </>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-printflow-success-container/50">
              <CheckCircle2 className="w-7 h-7 text-printflow-success" />
            </span>
            <h1 className="text-xl font-bold text-printflow-on-surface">
              Password updated
            </h1>
            <p className="text-sm text-printflow-on-surface-variant">
              Sign in with your new password.
            </p>
            <Link href="/login" className="mt-2">
              <Button variant="primary">Back to login</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
