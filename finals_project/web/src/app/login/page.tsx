"use client";

/**
 * Login page — split-screen layout.
 *
 * Left  (md+): branded panel in deep teal, with the PrintFlow wordmark,
 *              "Brialyns Art Sign" tagline, and a layered illustration made
 *              from existing tokens only (no new colors / fonts / icons).
 * Right (md+): login form on the cream ground, white card.
 * Mobile:      illustration panel is hidden (`hidden md:flex`); form takes
 *              the full width and stays usable down to 320 px.
 *
 * Auth, validation, routing, and `useAuth()` calls are unchanged from the
 * previous centered-card version. This file is a UI/UX pass only.
 */
import { useState, useId, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
 Loader2,
 LogIn,
 Eye,
 EyeOff,
 Printer,
 Package,
 LayoutDashboard,
 Factory,
 Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";

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

 const emailId = useId();
 const passwordId = useId();
 const rememberId = useId();
 const forgotId = useId();

 // Field-level validation (visual only — the real check is Firebase's).
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

 return (
  <div className="min-h-screen flex bg-printflow-bg">
   {/* ──────────────────────────── LEFT: BRAND PANEL ──────────────────────────── */}
   <aside
    data-login-brand
    className="hidden md:flex md:w-5/12 lg:w-5/12 flex-col justify-between
               bg-printflow-primary text-printflow-on-primary
               px-10 py-12 lg:px-14 lg:py-16 relative overflow-hidden"
    aria-label="PrintFlow brand panel"
   >
    {/* Subtle radial wash using only existing tokens — no new color. */}
    <div
     aria-hidden
     className="absolute inset-0 pointer-events-none opacity-30"
     style={{
      background:
       "radial-gradient(circle at 80% 0%, var(--color-printflow-primary-fixed) 0%, transparent 55%)",
     }}
    />

    {/* Brand mark + wordmark */}
    <header className="relative z-10 flex items-center gap-3">
     <div
      className="w-11 h-11 rounded-xl bg-printflow-on-primary
                 flex items-center justify-center shadow-sm"
      aria-hidden
     >
      <Printer className="w-6 h-6 text-printflow-primary" />
     </div>
     <div className="flex flex-col leading-tight">
      <span className="text-lg font-bold tracking-tight">PrintFlow</span>
      <span className="text-xs text-printflow-on-primary/75">
       Brialyns Art Sign
      </span>
     </div>
    </header>

    {/* Center: product illustration built from existing tokens.
        Three layered tiles representing the three product surfaces
        (POS / Inventory / Production) with a small floating accent. */}
    <div
     className="relative z-10 flex-1 flex items-center justify-center py-10"
     aria-hidden
    >
     <div className="relative w-full max-w-sm">
      {/* Background tile — primary container */}
      <div
       className="absolute -top-4 -left-4 w-44 h-32 rounded-2xl
                  bg-printflow-primary-container/40
                  border border-printflow-on-primary/10
                  shadow-sm float-a"
      />
      {/* Foreground tile — surface, holds the title */}
      <div
       className="relative w-56 h-40 rounded-2xl
                  bg-printflow-surface text-printflow-on-surface
                  shadow-lg p-5 flex flex-col justify-between
                  border border-printflow-outline-variant/30"
      >
       <div className="flex items-center justify-between">
        <span className="type-label text-printflow-on-surface-variant">
         Today
        </span>
        <span className="w-2 h-2 rounded-full bg-printflow-success" />
       </div>
       <div>
        <div className="type-headline leading-none">12</div>
        <div className="text-xs text-printflow-on-surface-variant mt-1">
         orders in production
        </div>
       </div>
      </div>
      {/* Side tile — primary-fixed accent */}
      <div
       className="absolute -right-2 top-12 w-40 h-24 rounded-2xl
                  bg-printflow-primary-fixed
                  shadow-md p-4 flex flex-col justify-between
                  border border-printflow-outline-variant/20 float-b"
      >
       <Package
        className="w-5 h-5 text-printflow-on-primary-fixed"
        aria-hidden
       />
       <div className="text-xs text-printflow-on-primary-fixed-variant font-semibold">
        3 items low
       </div>
      </div>
      {/* Small accent tile — bottom */}
      <div
       className="absolute -bottom-2 left-10 w-32 h-16 rounded-xl
                  bg-printflow-on-primary/10
                  border border-printflow-on-primary/15
                  backdrop-blur-sm p-3 flex items-center gap-2 float-c"
      >
       <Factory
        className="w-4 h-4 text-printflow-primary-fixed"
        aria-hidden
       />
       <span className="text-xs text-printflow-on-primary/90 font-medium">
        4 sensors online
       </span>
      </div>
     </div>
    </div>

    {/* Footer: feature pills matching the actual product surface */}
    <footer className="relative z-10 space-y-3">
     <p className="text-sm text-printflow-on-primary/80 leading-relaxed max-w-xs">
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
                   bg-printflow-on-primary/10
                   border border-printflow-on-primary/15
                   text-xs font-medium text-printflow-on-primary/90"
       >
        <Icon className="w-3.5 h-3.5" aria-hidden />
        {label}
       </li>
      ))}
     </ul>
    </footer>
   </aside>

   {/* ──────────────────────────── RIGHT: FORM ──────────────────────────── */}
   <main
    className="flex-1 flex items-center justify-center
               bg-printflow-bg px-6 py-10 sm:px-10"
   >
    <div className="w-full max-w-md">
     {/* Mobile-only brand mark (the left panel is hidden on mobile) */}
     <div className="md:hidden mb-8 flex items-center gap-3">
      <div
       className="w-10 h-10 rounded-xl bg-printflow-primary
                  flex items-center justify-center shadow-sm"
       aria-hidden
      >
       <Printer className="w-5 h-5 text-printflow-on-primary" />
      </div>
      <div className="flex flex-col leading-tight">
       <span className="text-base font-bold tracking-tight text-printflow-on-surface">
        PrintFlow
       </span>
       <span className="text-xs text-printflow-on-surface-variant">
        Brialyns Art Sign
       </span>
      </div>
     </div>

     <header className="mb-7">
      <h1 className="type-headline text-printflow-on-surface">
       Welcome back
      </h1>
      <p className="type-body text-printflow-on-surface-variant mt-2">
       Sign in to monitor orders, inventory, and production.
      </p>
     </header>

     <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-printflow-surface rounded-2xl
                 border border-printflow-outline-variant/40
                 shadow-sm p-7 sm:p-8 space-y-5"
      aria-describedby={error ? "login-error" : undefined}
     >
      {/* Email */}
      <div>
       <label
        htmlFor={emailId}
        className="block type-label font-semibold
                   text-printflow-on-surface-variant
                   uppercase tracking-wide mb-1.5"
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
       {emailIsInvalid && (
        <p
         id={`${emailId}-error`}
         className="text-xs text-printflow-error mt-1.5"
        >
         Please enter a valid email address.
        </p>
       )}
      </div>

      {/* Password */}
      <div>
       <label
        htmlFor={passwordId}
        className="block type-label font-semibold
                   text-printflow-on-surface-variant
                   uppercase tracking-wide mb-1.5"
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
         placeholder="••••••••"
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
          <EyeOff className="w-4 h-4" aria-hidden />
         ) : (
          <Eye className="w-4 h-4" aria-hidden />
         )}
        </button>
       </div>
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
                     peer-focus-visible:ring-2 peer-focus-visible:ring-printflow-primary
                     peer-checked:bg-printflow-primary
                     peer-checked:border-printflow-primary
                     transition-colors"
          aria-hidden
         >
          <Check
           className="w-3 h-3 text-printflow-on-primary
                      opacity-0 peer-checked:opacity-100"
          />
         </span>
        </span>
        Keep me signed in
       </label>

       {/* Forgot-password — Firebase Auth supports it via
           `sendPasswordResetEmail`, but the auth hook doesn't expose
           it yet. Wired as a non-functional placeholder so the link
           doesn't lie about doing something. */}
       <a
        id={forgotId}
        href="#"
        onClick={(e) => e.preventDefault()}
        className="text-sm font-medium text-printflow-primary
                   hover:text-printflow-primary-container
                   focus:outline-none focus:ring-2 focus:ring-printflow-primary
                   rounded px-1 -mx-1 transition-colors"
        title="Password reset is not yet wired up — ask the admin to reset it for you."
       >
        Forgot password?
       </a>
      </div>

      {/* Auth error banner */}
      {error && (
       <div
        id="login-error"
        role="alert"
        className="px-3.5 py-2.5 text-sm
                   bg-printflow-error-container/30
                   text-printflow-error
                   rounded-lg border border-printflow-error-container/50
                   flex items-start gap-2"
       >
        <span
         aria-hidden
         className="mt-0.5 w-1.5 h-1.5 rounded-full bg-printflow-error shrink-0"
        />
        <span>{error}</span>
       </div>
      )}

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

      {/* Submit */}
      <Button
       type="submit"
       variant="primary"
       size="lg"
       fullWidth
       loading={submitting}
       disabled={submitting || !configured}
       icon={
        submitting ? (
         <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
         <LogIn className="w-4 h-4" />
        )
       }
       className="mt-1"
      >
       {submitting ? "Signing in…" : "Sign in"}
      </Button>
     </form>

     {/* "First time here" — disabled by design: this is an internal
         admin tool, not a self-serve product. Owner creates accounts
         via the Users page (or directly in Firebase Auth). */}
     <p className="text-sm text-printflow-on-surface-variant text-center mt-6">
      First time here?{" "}
      <span
       className="text-printflow-on-surface-variant/70 cursor-help
                  border-b border-dotted border-printflow-outline-variant"
       title="PrintFlow is invite-only. Ask the Owner to add you via the Users page."
      >
       Ask the Owner for an invite
      </span>
      .
     </p>

     <p className="text-xs text-printflow-on-surface-variant/70 text-center mt-4">
      PrintFlow • Brialyns Art Sign, Sta. Cruz, Laguna
     </p>
    </div>
   </main>
  </div>
 );
}
