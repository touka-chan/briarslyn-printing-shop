"use client";

import { useCallback, useState } from "react";

/**
 * Shared Firestore feed status for pages.
 *
 * Pass `onFeedError` into any `subscribe*` call and `feedNonce` into the
 * subscribing `useEffect` deps. When a feed fails (permission denied,
 * offline), `feedError` carries a human message and `retryFeed` clears
 * it + retriggers every subscription via the nonce.
 */
export function useFeedStatus() {
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedNonce, setFeedNonce] = useState(0);

  const onFeedError = useCallback((e: unknown) => {
    console.error("[feed] subscription failed:", e);
    setFeedError(
      e instanceof Error && e.message
        ? e.message
        : "Couldn't load live data. Check your connection and permissions.",
    );
  }, []);

  const retryFeed = useCallback(() => {
    setFeedError(null);
    setFeedNonce((n) => n + 1);
  }, []);

  return { feedError, onFeedError, feedNonce, retryFeed };
}
