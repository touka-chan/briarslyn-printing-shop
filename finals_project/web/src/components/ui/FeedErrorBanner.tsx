"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface FeedErrorBannerProps {
  /** Raw error message from the failed subscription. */
  message: string;
  /** True when stale/partial data is on screen behind the banner. */
  showCached?: boolean;
  /** Clears the error and re-runs the subscriptions. */
  onRetry: () => void;
  className?: string;
}

/**
 * Slim warning banner for failed Firestore feeds (permission denied,
 * offline). Rendered above page content so a feed failure is visible
 * and recoverable instead of a silent spinner or stale screen.
 */
export function FeedErrorBanner({
  message,
  showCached = false,
  onRetry,
  className = "",
}: FeedErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`mb-6 px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm flex flex-wrap items-center gap-3 ${className}`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-52">
        Live data failed to load{showCached ? " - showing cached data" : ""}:{" "}
        {message}
      </span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
