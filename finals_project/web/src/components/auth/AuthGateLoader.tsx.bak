/**
 * Client-only mount gate for `<AuthGate>`.
 *
 * The gate reads `usePathname()` / `useRouter()`, which cannot run during
 * a static-export prerender (no request context — the build dies with
 * `Invariant: Expected workStore to be initialized` on `/_global-error`).
 *
 * History of what did NOT work, so nobody "simplifies" this back:
 *  1. Rendering `<AuthGate>` directly in the root layout → build crash.
 *  2. Wrapping it in `<Suspense>` → build passes, but the prerendered
 *     boundary state can never be resumed by the client: every page stays
 *     frozen on "Loading…" forever, with zero console errors.
 *  3. `next/dynamic(..., { ssr: false })` → build passes, but the lazy
 *     chunk never resolves against the static export: same frozen page.
 *
 * This pattern avoids all three failure modes with no lazy chunks, no
 * suspense boundary, and no manifest: the prerender AND the first client
 * render both emit the identical static fallback below (hydration is
 * trivially consistent), then the `useEffect` flips `mounted` and the
 * real gate renders with a live router. The gate module stays statically
 * imported, so it ships in the main chunk — slightly larger, always
 * present, zero loading risk.
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthGate } from "./AuthGate";

function AuthLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif",
        background: "#fbf9f4",
        color: "#0b1314",
      }}
    >
      <p style={{ fontSize: 14, opacity: 0.7 }}>Loading PrintFlow…</p>
    </div>
  );
}

export function AuthGateLoader({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <AuthLoadingFallback />;
  }
  return <AuthGate>{children}</AuthGate>;
}
