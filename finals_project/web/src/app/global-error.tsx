"use client";

/**
 * Root error boundary. Catches errors thrown by the root layout itself
 * (where app/error.tsx cannot render because the layout failed). It must
 * supply its own <html>/<body> and cannot rely on globals.css classes,
 * so the styling is inline - same visual language as not-found.tsx.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif",
            background: "#fbf9f4",
            color: "#0b1314",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 420,
              textAlign: "center",
              padding: 24,
              background: "#ffffff",
              border: "1px solid rgba(11, 19, 20, 0.08)",
              borderRadius: 16,
            }}
          >
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(11, 19, 20, 0.7)",
                margin: "8px 0 20px",
              }}
            >
              The app hit an unexpected error. Reload to try again.
            </p>
            <button
              onClick={reset}
              style={{
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 999,
                background: "#17171c",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
