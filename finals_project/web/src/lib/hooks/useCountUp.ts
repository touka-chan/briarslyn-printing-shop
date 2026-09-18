/**
 * useCountUp - animate a numeric value from its previous display toward
 * a new target with an ease-out cubic over ~900ms. Respects
 * prefers-reduced-motion (jumps straight to the target). Used by KPI
 * cards and summary tiles so numbers count up instead of snapping.
 */
"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUp(target: number, durationMs = DURATION_MS): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const targetRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    targetRef.current = target;
    if (from === target || prefersReducedMotion()) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      displayRef.current = v;
      setDisplay(v);
      if (t < 1 && targetRef.current === target) {
        raf = requestAnimationFrame(tick);
      } else {
        displayRef.current = targetRef.current;
        setDisplay(targetRef.current);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

interface SplitNumeric {
  prefix: string;
  num: number;
  suffix: string;
  decimals: number;
}

/** Split "₱12,500" / "67%" / "1,234" into affixes + number, else null. */
export function splitNumeric(raw: string): SplitNumeric | null {
  const m = raw.match(/^([^0-9\-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const num = Number(m[2].replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  const decimals = m[2].includes(".") ? (m[2].split(".")[1] ?? "").length : 0;
  return { prefix: m[1], num, suffix: m[3], decimals };
}

/** Format a count-up frame with grouping + original decimals. */
export function formatCountUp(v: number, decimals: number): string {
  return v.toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
