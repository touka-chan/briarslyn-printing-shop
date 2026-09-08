/**
 * TEMPORARY boot-error probe (delete after diagnosing the blank page).
 *
 * Paints any window error / unhandled rejection into a fixed overlay that
 * survives React unmounting the root, so a headless screenshot reveals the
 * exact crash text even when the console is unavailable.
 */
"use client";

import { useEffect } from "react";

function paint(msg: string) {
  try {
    let el = document.getElementById("boot-probe");
    if (!el) {
      el = document.createElement("pre");
      el.id = "boot-probe";
      el.style.cssText =
        "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;" +
        "background:#7f1d1d;color:#fff;padding:12px;font-size:12px;" +
        "white-space:pre-wrap;max-height:40vh;overflow:auto;margin:0;";
      document.body.appendChild(el);
    }
    el.textContent = (el.textContent + "\n" + msg).slice(-3000);
  } catch {
    /* ignore */
  }
}

export function BootProbe() {
  useEffect(() => {
    paint("BOOT-PROBE: mounted, pathname=" + window.location.pathname);
    const onErr = (e: ErrorEvent) =>
      paint("WINDOW-ERROR: " + (e.message || "") + " @ " + (e.filename || "") + ":" + (e.lineno || ""));
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason as unknown;
      const msg =
        r instanceof Error ? r.stack || r.message : String(r).slice(0, 500);
      paint("UNHANDLED-REJECTION: " + msg);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}
