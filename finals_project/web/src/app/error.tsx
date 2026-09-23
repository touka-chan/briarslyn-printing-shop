"use client";

/**
 * Route-level error boundary. Catches render/runtime errors from any
 * page so a single crash shows a recoverable card instead of a blank
 * white screen. `reset()` re-renders the failed segment; the dashboard
 * link is the escape hatch when the error is persistent.
 */
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e2e5e9] px-4 py-10">
      <div className="w-full max-w-md bg-printflow-surface rounded-2xl border border-printflow-outline-variant/40 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.16)] text-center">
        <span className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-printflow-error/10">
          <AlertTriangle className="w-7 h-7 text-printflow-error" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-printflow-on-surface">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm text-printflow-on-surface-variant">
          This page hit an unexpected error. Your data is safe - try again or
          head back to the dashboard.
        </p>
        {error?.message && (
          <p className="mt-3 px-3 py-2 rounded-lg bg-printflow-surface-container text-[11px] font-mono text-printflow-on-surface-variant break-all">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex gap-2.5">
          <Button variant="secondary" onClick={reset} className="flex-1 py-3">
            Try again
          </Button>
          <Link href="/dashboard" className="flex-[2]">
            <Button variant="primary" className="w-full py-3">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
