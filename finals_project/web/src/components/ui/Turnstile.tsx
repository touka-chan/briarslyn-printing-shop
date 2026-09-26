"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile ("verify you are human") checkbox.
 *
 * The site key is PUBLIC by design — verification happens in our Worker
 * (`POST /verify-turnstile`), which holds the secret. Tokens are
 * single-use: remount with a new `key` (nonce) to get a fresh challenge.
 */

const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAFEiclV7gRjng3sH";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({
  onVerify,
  onExpire,
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef({ onVerify, onExpire });
  cb.current = { onVerify, onExpire };

  useEffect(() => {
    let widgetId: string | null = null;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => cb.current.onVerify(token),
          "expired-callback": () => cb.current.onExpire?.(),
          "error-callback": () => cb.current.onExpire?.(),
          theme: "auto",
        });
      })
      .catch(() => {
        // CDN blocked/offline — the Sign in button stays disabled and the
        // hint below tells the user why.
      });
    return () => {
      alive = false;
      try {
        if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      } catch {
        // Widget already gone — nothing to clean.
      }
    };
  }, []);

  return <div ref={ref} aria-label="Human verification" />;
}
