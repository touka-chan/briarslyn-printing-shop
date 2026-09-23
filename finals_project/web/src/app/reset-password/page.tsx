"use client";

/**
 * Password-reset landing page — the destination of the Gmail reset link.
 *
 * Firebase appends ?mode=resetPassword&oobCode=... to this URL. We read
 * the query client-side (no useSearchParams, so static export stays
 * happy), verify the code to reveal the account email, then let the user
 * set a new password + confirm (with eye toggles) via
 * confirmPasswordReset.
 *
 * Layout mirrors the login page (split floating card: dark brand panel
 * with paint-splash + form side) so the flow feels like one product.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Poppins } from "next/font/google";

/** Bold display face for brand + headlines (matches login). */
const poppins = Poppins({ subsets: ["latin"], weight: ["700", "800"] });
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Activity,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui";

type Status = "loading" | "ready" | "done" | "error" | "info";

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
      // No code in the URL. This happens when the user opens this page
      // directly, OR when Firebase's default email-link handler finishes
      // the reset and redirects to our continue URL. Either way, show a
      // friendly finish screen instead of a dead-end error.
      setStatus("info");
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-printflow-bg px-4 py-10 sm:px-6 relative overflow-hidden">
      {/* Backdrop wash - neutral gray to match the admin canvas (same as login). */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(40rem 22rem at 12% 0%, rgba(0,0,0,0.05) 0%, transparent 55%), radial-gradient(44rem 24rem at 88% 0%, rgba(0,0,0,0.06) 0%, transparent 55%)",
        }}
      />

      {/* Mobile-only brand row (the illustration panel is hidden on mobile) */}
      <div className="md:hidden relative mb-6 flex items-center gap-3">
        <img
          src="/logo.jpg"
          alt=""
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-black/80 shadow-sm"
        />
        <div className="flex flex-col leading-tight">
          <span className={`text-base font-bold tracking-[0.14em] text-printflow-on-surface ${poppins.className}`}>
            BRIALYNS ART SIGN
          </span>
          <span className="text-xs text-printflow-on-surface-variant">
            Print Shop Management
          </span>
        </div>
      </div>

      {/* Floating card */}
      <div
        className="relative w-full max-w-5xl grid md:grid-cols-[5fr_6fr]
                   bg-printflow-surface rounded-2xl overflow-hidden
                   border border-printflow-outline-variant/40
                   shadow-[0_24px_70px_rgba(0,0,0,0.18),0_8px_24px_rgba(0,0,0,0.08)]"
      >
        {/* ----------------- LEFT: BRAND + LOGO (same as login) ----------------- */}
        <aside
          className="hidden md:flex flex-col justify-between
                     bg-[#17171c] text-white
                     px-10 py-10 relative overflow-hidden"
          aria-label="Brialyns Art Sign brand panel"
        >
          {/* Aurora + grid backdrop (same as login): three drifting
              brand-tinted glows behind a faint grid. Pure CSS. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="login-blob login-blob-a absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[#ff8a3d]/20 blur-[70px]" />
            <div className="login-blob login-blob-b absolute -right-20 top-[6%] h-72 w-72 rounded-full bg-[#ff4d8d]/20 blur-[80px]" />
            <div className="login-blob login-blob-c absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-[#3d8bff]/20 blur-[90px]" />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 0%, transparent 35%, #17171c 100%)",
              }}
            />
          </div>

          <header className="relative z-10 flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt=""
              width={44}
              height={44}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/80 shadow-sm"
            />
            <div className="flex flex-col leading-tight">
              <span className={`text-lg font-bold tracking-[0.14em] ${poppins.className}`}>BRIALYNS ART SIGN</span>
              <span className="text-xs text-white/70">
                Print Shop Management
              </span>
            </div>
          </header>

          {/* Hero: kinetic word cycle (same as login). */}
          <div className="relative z-10 py-6" aria-hidden>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
              One system for
            </p>
            <div className="mt-3 h-16 overflow-hidden">
              <div className="login-word-cycle flex flex-col">
                {["ORDERS", "INVENTORY", "PRODUCTION", "INSIGHTS", "ORDERS"].map(
                  (word, i) => (
                    <span
                      key={`${word}-${i}`}
                      className={`flex h-16 items-center whitespace-nowrap text-3xl font-extrabold tracking-tight text-white lg:text-5xl ${poppins.className}`}
                    >
                      {word}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="mt-6 h-px w-44 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>

          <footer className="relative z-10 space-y-3">
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              Integrated POS, IoT inventory, and order workflow for Brialyns Art Sign,
              Sta. Cruz, Laguna.
            </p>
            <ul className="flex flex-wrap gap-2">
              {[
                { icon: Activity, label: "Live sync" },
                { icon: ShieldCheck, label: "Role-based access" },
                { icon: ScrollText, label: "Audit trail" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5
                             px-3 py-1.5 rounded-full
                             bg-white/10
                             border border-white/15
                             text-xs font-medium text-white/90"
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </footer>
        </aside>

        {/* ----------------- RIGHT: FORM ----------------- */}
        <main className="flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-md">
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
                <h1 className={`type-headline font-bold text-printflow-on-surface ${poppins.className}`}>
                  Link problem
                </h1>
                <p className="type-body text-printflow-on-surface-variant">{fatal}</p>
                <Link href="/login" className="mt-2">
                  <Button variant="primary">Back to login</Button>
                </Link>
              </div>
            )}

            {status === "info" && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-printflow-primary-fixed">
                  <KeyRound className="w-7 h-7 text-printflow-primary" />
                </span>
                <h1 className={`type-headline font-bold text-printflow-on-surface ${poppins.className}`}>
                  Finish password reset
                </h1>
                <p className="type-body text-printflow-on-surface-variant">
                  Open the reset link from your email to choose a new password
                  and confirm it. If you already completed the reset in your
                  email tab, your password is updated — sign in with your new
                  password.
                </p>
                <Link href="/login" className="mt-2">
                  <Button variant="primary">Back to login</Button>
                </Link>
              </div>
            )}

            {status === "ready" && (
              <>
                <header className="mb-7">
                  <h1 className={`type-headline font-bold text-printflow-on-surface ${poppins.className}`}>
                    Choose a new password
                  </h1>
                  <p className="type-body text-printflow-on-surface-variant mt-2">
                    For <span className="font-medium">{email}</span>
                  </p>
                </header>
                <div className="space-y-5">
                  {formError && (
                    <div
                      role="alert"
                      className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
                    >
                      {formError}
                    </div>
                  )}
                  <div>
                    <label className="block type-label font-semibold text-printflow-on-surface-variant mb-1.5">
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
                    <label className="block type-label font-semibold text-printflow-on-surface-variant mb-1.5">
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
                <h1 className={`type-headline font-bold text-printflow-on-surface ${poppins.className}`}>
                  Password updated
                </h1>
                <p className="type-body text-printflow-on-surface-variant">
                  Sign in with your new password.
                </p>
                <Link href="/login" className="mt-2">
                  <Button variant="primary">Back to login</Button>
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
