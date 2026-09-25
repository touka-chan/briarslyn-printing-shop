/**
 * Desktop sidebar collapse preference.
 *
 * Every page renders its own AdminLayout, so the Sidebar remounts on
 * each navigation. The choice lives in a module-level store (stable
 * across remounts, so nothing flashes or re-animates on route changes)
 * and is mirrored to localStorage plus the `sidebar-collapsed` class on
 * <html>. globals.css drives the rail width, the hidden labels, and the
 * content margin from that class; the root layout restores it before
 * first paint so a collapsed rail never appears expanded on reload.
 */
"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "printflow-sidebar-collapsed";
/** Keep in sync with the bootstrap script in app/layout.tsx. */
const COLLAPSED_CLASS = "sidebar-collapsed";

let collapsed = false;
let loaded = false;
const listeners = new Set<() => void>();

function getCollapsed(): boolean {
  if (!loaded) {
    loaded = true;
    if (typeof window !== "undefined") {
      try {
        collapsed = window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        // Storage blocked - default to expanded.
      }
    }
  }
  return collapsed;
}

function getServerCollapsed(): boolean {
  return false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Flips the desktop rail and persists the choice. */
export function toggleSidebarCollapsed(): void {
  const next = !getCollapsed();
  collapsed = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked - the choice just won't survive a reload.
    }
    document.documentElement.classList.toggle(COLLAPSED_CLASS, next);
  }
  for (const listener of listeners) listener();
}

export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggle: () => void;
} {
  const value = useSyncExternalStore(
    subscribe,
    getCollapsed,
    getServerCollapsed,
  );
  return { collapsed: value, toggle: toggleSidebarCollapsed };
}
