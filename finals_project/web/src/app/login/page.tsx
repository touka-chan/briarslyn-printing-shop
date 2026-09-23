"use client";

/**
 * Login page - NWORX-style centered floating card, Brialyns theme.
 *
 * Card (all screens): floating rounded-2xl surface on the cream ground,
 * two columns on md+ (brand/logo panel + form), stacked on mobile with
 * a compact brand row on top.
 *
 * Left panel: near-black ground with paint-splash glows sampled from
 * the real shop badge (`logo.jpg`), circular logo hero, product
 * caption + surface pills. Scoped to this page only - no token changes.
 *
 * Right: form only (no nested card - like the reference). Sentence-case
 * labels, inline validation affordances, keep-signed-in, and the
 * invite-only footer.
 *
 * Auth, validation, routing, and `useAuth()` calls are unchanged.
 * This file is a UI/UX pass only.
 */
import { useState, useId, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";

/** Bold display face for brand + headlines (login only, self-hosted). */
const poppins = Poppins({ subsets: ["latin"], weight: ["700", "800"] });
import {
  Loader2,
  LogIn,
  Eye,
  EyeOff,
  Package,
  LayoutDashboard,
  Factory,
  Check,
  Mail,
  KeyRound,
} from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Modal, Button } from "@/components/ui";
import { auth } from "@/lib/firebase";
import { findUserByEmail } from "@/lib/services/users";
import { useAuth } from "@/lib/auth";


export default function LoginPage() {
  const { signIn, error, configured } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  // Forgot-password modal state.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();
  const forgotId = useId();

  // Field-level validation (visual only - the real check is Firebase's).
  const emailIsInvalid = emailTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordIsInvalid = passwordTouched && password.length > 0 && password.length < 6;
  const passwordEmpty = passwordTouched && password.length === 0;

  const handleSubmit = async (e: FormEvent) => {
   e.preventDefault();
   setEmailTouched(true);
   setPasswordTouched(true);
   if (!email || !password) return;
   setSubmitting(true);
   try {
    await signIn(email, password, keepSignedIn);
    router.push("/dashboard");
   } catch {
    // `useAuth().error` already carries the humanized message.
   } finally {
    setSubmitting(false);
   }
  };

  /**
   * Forgot-password flow: validate the email, confirm an account exists
   * in our users collection (Firebase itself never confirms this, to
   * avoid user enumeration — we check OUR database instead), then send
   * a reset link that lands on /reset-password.
   *
   * `handleCodeInApp: true` makes Firebase put the oobCode directly on
   * our continue URL instead of routing through the Google-owned
   * `firebaseapp.com/__/auth/action` widget. The email link therefore
   * opens OUR branded page (split card, confirm password + eye
   * toggles) - no console "customize action URL" needed. The domain
   * must be in Authentication > Settings > Authorized domains, which
   * `.web.app` is.
   */
  const RESET_URL =
   typeof window !== "undefined"
    ? `${window.location.origin}/reset-password`
    : "";

  const handleForgotSend = async () => {
   const em = forgotEmail.trim();
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    setForgotError("Enter a valid email address.");
    return;
   }
   if (!auth) {
    setForgotError("Firebase is not configured.");
    return;
   }
   setForgotBusy(true);
   setForgotError(null);
   try {
    const uid = await findUserByEmail(em).catch(() => null);
    if (!uid) {
     setForgotError("No account found for that email.");
     return;
    }
    await sendPasswordResetEmail(auth, em, {
     url: RESET_URL,
     handleCodeInApp: true,
    });
    setForgotSent(true);
   } catch (e) {
    setForgotError(
     e instanceof Error ? e.message : "Could not send reset email.",
    );
   } finally {
    setForgotBusy(false);
   }
  };

  return (
   <div className="min-h-screen flex flex-col items-center justify-center bg-printflow-bg px-4 py-10 sm:px-6 relative overflow-hidden">
    {/* Backdrop wash - neutral gray to match the admin canvas. */}
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
     className="relative w-full max-w-6xl grid md:grid-cols-[5fr_6fr]
                bg-printflow-surface rounded-2xl overflow-hidden
                border border-printflow-outline-variant/40
                shadow-[0_24px_70px_rgba(0,0,0,0.18),0_8px_24px_rgba(0,0,0,0.08)]"
    >
     {/* ----------------- LEFT: BRAND + LOGO ----------------- */}
     <aside
      data-login-brand
       className="hidden md:flex flex-col justify-between
                  bg-[#17171c] text-white
                  px-12 py-12 relative overflow-hidden"
      aria-label="Brialyns Art Sign brand panel"
     >
      {/* Faint top light for depth - monochrome like the admin. */}
      <div
       aria-hidden
       className="absolute inset-0 pointer-events-none"
       style={{
        background:
         "radial-gradient(circle at 80% 0%, rgba(255,255,255,0.08) 0%, transparent 50%)",
       }}
      />

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

      <div className="relative z-10 py-6" aria-hidden>
        {/* Real paint-splash photography (free license, self-hosted).
            Background keyed to transparent. No radius, no shadow, no
            border — so it melts seamlessly into the dark brand panel
            with zero box edges. */}
        <img
          src="/login-splash.png"
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
          width={880}
          height={502}
          className="w-full h-auto login-float"
        />
      </div>

      <footer className="relative z-10 space-y-3">
       <p className="text-sm text-white/70 leading-relaxed max-w-xs">
        Integrated POS, IoT inventory, and order workflow for Brialyns Art Sign,
        Sta. Cruz, Laguna.
       </p>
       <ul className="flex flex-wrap gap-2">
        {[
         { icon: LayoutDashboard, label: "POS" },
         { icon: Package, label: "Inventory" },
         { icon: Factory, label: "Production" },
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
     <main className="flex items-center justify-center px-6 py-12 sm:px-14">
      <div className="w-full max-w-md">
       <header className="mb-7">
        <h1 className={`type-headline font-bold text-printflow-on-surface ${poppins.className}`}>
         Welcome back
        </h1>
        <p className="type-body text-printflow-on-surface-variant mt-2">
         Sign in to monitor orders, inventory, and production.
        </p>
       </header>

       <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5"
        aria-describedby={error ? "login-error" : undefined}
       >
        {/* Email */}
        <div>
         <label
          htmlFor={emailId}
          className="block type-label font-semibold
                     text-printflow-on-surface-variant mb-1.5"
         >
          Email address
         </label>
         <input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          aria-invalid={emailIsInvalid || undefined}
          aria-describedby={
           emailIsInvalid ? `${emailId}-error` : undefined
          }
          placeholder="you@brialyns.com"
          className={[
           "w-full px-4 py-2.5 text-sm rounded-lg",
           "bg-printflow-surface-container",
           "border transition-all duration-200",
           "focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent",
           emailIsInvalid
            ? "border-printflow-error"
            : "border-printflow-outline-variant",
          ].join(" ")}
         />
          {/* Reserved slot: errors appear without pushing layout. */}
          <div className="min-h-[22px]">
           {emailIsInvalid && (
            <p
             id={`${emailId}-error`}
             className="text-xs text-printflow-error mt-1.5"
            >
             Please enter a valid email address.
            </p>
           )}
          </div>
        </div>

        {/* Password */}
        <div>
         <label
          htmlFor={passwordId}
          className="block type-label font-semibold
                     text-printflow-on-surface-variant mb-1.5"
         >
          Password
         </label>
         <div className="relative">
          <input
           id={passwordId}
           type={showPassword ? "text" : "password"}
           required
           autoComplete="current-password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           onBlur={() => setPasswordTouched(true)}
           aria-invalid={
            (passwordIsInvalid || passwordEmpty) || undefined
           }
           aria-describedby={
            passwordIsInvalid || passwordEmpty
             ? `${passwordId}-error`
             : undefined
           }
           placeholder="********"
           className={[
            "w-full pl-4 pr-12 py-2.5 text-sm rounded-lg",
            "bg-printflow-surface-container",
            "border transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent",
            passwordIsInvalid || passwordEmpty
             ? "border-printflow-error"
             : "border-printflow-outline-variant",
           ].join(" ")}
          />
          <button
           type="button"
           onClick={() => setShowPassword((v) => !v)}
           aria-label={showPassword ? "Hide password" : "Show password"}
           aria-pressed={showPassword}
           aria-controls={passwordId}
           className="absolute right-1 top-1/2 -translate-y-1/2
                      w-9 h-9 inline-flex items-center justify-center
                      rounded-md text-printflow-on-surface-variant
                      hover:text-printflow-on-surface
                      hover:bg-printflow-surface-container-high
                      focus:outline-none focus:ring-2 focus:ring-printflow-primary
                      transition-colors"
          >
            {showPassword ? (
             <Eye className="w-4 h-4" aria-hidden />
            ) : (
             <EyeOff className="w-4 h-4" aria-hidden />
            )}
          </button>
         </div>
          {/* Reserved slot: errors appear without pushing layout. */}
          <div className="min-h-[22px]">
           {passwordEmpty ? (
            <p
             id={`${passwordId}-error`}
             className="text-xs text-printflow-error mt-1.5"
            >
             Password is required.
            </p>
           ) : passwordIsInvalid ? (
            <p
             id={`${passwordId}-error`}
             className="text-xs text-printflow-error mt-1.5"
            >
             Password must be at least 6 characters.
            </p>
           ) : null}
          </div>
        </div>

        {/* Remember + Forgot */}
        <div className="flex items-center justify-between pt-1">
         <label
          htmlFor={rememberId}
          className="inline-flex items-center gap-2 cursor-pointer
                     text-sm text-printflow-on-surface-variant
                     select-none"
         >
          <span className="relative inline-flex items-center">
           <input
            id={rememberId}
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            className="peer sr-only"
           />
           <span
            className="w-4 h-4 rounded border
                       border-printflow-outline-variant
                       bg-printflow-surface
                       flex items-center justify-center
                       peer-focus-visible:ring-2 peer-focus-visible:ring-black
                       peer-checked:bg-[#17171c]
                       peer-checked:border-[#17171c]
                       transition-colors"
            aria-hidden
           >
            <Check
             className="w-3 h-3 text-white
                        opacity-0 peer-checked:opacity-100"
            />
           </span>
          </span>
          Keep me signed in
         </label>

          <button
           id={forgotId}
           type="button"
           onClick={() => {
            setForgotEmail(email);
            setForgotError(null);
            setForgotSent(false);
            setForgotOpen(true);
           }}
           className="text-sm font-medium text-printflow-primary
                      hover:text-printflow-primary-container
                      focus:outline-none focus:ring-2 focus:ring-printflow-primary
                      rounded px-1 -mx-1 transition-colors"
          >
           Forgot password?
          </button>
        </div>



        {/* Misconfig banner */}
        {!configured && (
         <div
          role="status"
          className="px-3.5 py-2.5 text-sm
                     bg-printflow-warning-container/40
                     text-printflow-warning
                     rounded-lg border border-printflow-warning-container/60"
         >
          Firebase is not configured yet. See SETUP_FIREBASE.md.
         </div>
        )}

        {/* Submit - near-black to match the badge (login-only).
            Native button: the shared Button has no class-merging, so a
            black override would fight its teal classes unpredictably. */}
        {/* Auth error floats over the footer text below (absolute overlay)
            so the card height never changes on sign-in failure. */}
        <div className="relative">
         <button
          type="submit"
          disabled={submitting || !configured}
          className={`mt-1 inline-flex items-center justify-center gap-2 w-full
                     px-6 py-3 text-base font-bold rounded-lg text-white
                     bg-[#17171c] hover:bg-black
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 ${poppins.className}`}
         >
          {submitting ? (
           <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
           <LogIn className="w-4 h-4" aria-hidden />
          )}
          {submitting ? "Signing in..." : "Sign in"}
         </button>
         {error && (
          <div
           id="login-error"
           role="alert"
           aria-live="polite"
           className="absolute left-0 right-0 top-full mt-3 z-10
                      px-3.5 py-2.5 text-sm
                      bg-printflow-surface
                      text-printflow-error
                      rounded-lg border border-printflow-error-container/50
                      shadow-[0_16px_40px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)]
                      flex items-start gap-2 animate-[fade-in_200ms_ease-out]"
          >
           <span
            aria-hidden
            className="mt-0.5 w-1.5 h-1.5 rounded-full bg-printflow-error shrink-0"
           />
           <span>{error}</span>
          </div>
         )}
        </div>
       </form>

       {/* "First time here" - disabled by design: this is an internal
           admin tool, not a self-serve product. Owner creates accounts
           via the Users page (or directly in Firebase Auth). */}
       <p className="text-sm text-printflow-on-surface-variant text-center mt-6">
        First time here?{" "}
        <span
         className="text-printflow-on-surface-variant/70 cursor-help
                    border-b border-dotted border-printflow-outline-variant"
          title="This system is invite-only. Ask the Owner to add you via the Users page."
        >
         Ask the Owner for an invite
        </span>
        .
       </p>

        <p className="text-xs text-printflow-on-surface-variant/70 text-center mt-4">
         Brialyns Art Sign, Sta. Cruz, Laguna
        </p>
       </div>
      </main>
     </div>

     {/* Forgot-password modal: email -> existence check -> reset link. */}
     <Modal
      isOpen={forgotOpen}
      onClose={() => {
       if (!forgotBusy) {
        setForgotOpen(false);
        setForgotError(null);
        setForgotSent(false);
       }
      }}
      title="Reset your password"
      description={
       forgotSent
        ? undefined
        : "Enter your work email. If an account exists, a reset link will be sent."
      }
      icon={<KeyRound className="w-5 h-5" />}
      size="sm"
      footer={
       forgotSent ? (
        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
         <Button variant="primary" onClick={() => setForgotOpen(false)} className="flex-1 sm:flex-none">
          Done
         </Button>
        </div>
       ) : (
        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
         <Button
          variant="secondary"
          onClick={() => setForgotOpen(false)}
          className="flex-1 sm:flex-none"
          disabled={forgotBusy}
         >
          Cancel
         </Button>
         <Button
          variant="primary"
          onClick={() => void handleForgotSend()}
          className="flex-1 sm:flex-none"
          loading={forgotBusy}
          disabled={forgotBusy}
         >
          Send reset link
         </Button>
        </div>
       )
      }
     >
      {forgotSent ? (
       <div className="flex items-start gap-3 p-4 rounded-xl bg-printflow-success-container/40 border border-printflow-success-container/60">
        <Mail className="w-5 h-5 text-printflow-success shrink-0 mt-0.5" />
        <div className="text-sm">
         <p className="font-semibold text-printflow-on-surface">
          Check your Gmail
         </p>
         <p className="text-printflow-on-surface-variant mt-1">
          A reset link was sent to <span className="font-medium">{forgotEmail.trim()}</span>.
          Open it to choose a new password.
         </p>
        </div>
       </div>
      ) : (
       <div className="space-y-4">
        {forgotError && (
         <div
          role="alert"
          className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
         >
          {forgotError}
         </div>
        )}
        <div>
         <label className="block text-sm font-medium text-printflow-on-surface-variant mb-1">
          Work email
         </label>
         <input
          type="email"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          onKeyDown={(e) => {
           if (e.key === "Enter") void handleForgotSend();
          }}
          placeholder="you@brialyns.com"
          autoComplete="email"
          className="w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent"
         />
        </div>
       </div>
      )}
     </Modal>
    </div>
   );
}
