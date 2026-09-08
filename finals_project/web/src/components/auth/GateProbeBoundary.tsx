/**
 * TEMPORARY error boundary (delete after diagnosing the blank page).
 * React render errors never reach window.onerror — without a boundary the
 * root silently unmounts (blank page, zero console signal in headless).
 * This paints the real error + stack into the DOM so a screenshot shows it.
 */
"use client";

import { Component, type ReactNode } from "react";

export function paintFatal(msg: string) {
  try {
    let el = document.getElementById("boot-probe");
    if (!el) {
      el = document.createElement("pre");
      el.id = "boot-probe";
      el.style.cssText =
        "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;" +
        "background:#7f1d1d;color:#fff;padding:12px;font-size:12px;" +
        "white-space:pre-wrap;max-height:60vh;overflow:auto;margin:0;";
      document.body.appendChild(el);
    }
    el.textContent = (el.textContent + "\n" + msg).slice(-4000);
  } catch {
    /* ignore */
  }
}

export class GateProbeBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { error: String((e as Error)?.stack || e).slice(0, 2000) };
  }

  componentDidCatch(e: unknown) {
    paintFatal(
      "RENDER-CRASH: " + String((e as Error)?.stack || e).slice(0, 2000),
    );
  }

  render() {
    if (this.state.error) {
      paintFatal("RENDER-CRASH (derived): " + this.state.error);
      return null;
    }
    return this.props.children;
  }
}
