"use client";

import {
  formatCountUp,
  splitNumeric,
  useCountUp,
} from "@/lib/hooks/useCountUp";

interface CountUpProps {
  value: string | number;
  className?: string;
}

/**
 * Animated number: counts from 0 (or the previous value) up to `value`
 * with an ease-out. Plain strings without digits ("-", "N/A") render
 * as-is. Affixes and decimals are preserved ("₱12,500", "67%", "8.5").
 */
export function CountUp({ value, className }: CountUpProps) {
  const parsed =
    typeof value === "number"
      ? { prefix: "", num: value, suffix: "", decimals: 0 }
      : splitNumeric(value);
  const frame = useCountUp(parsed?.num ?? 0);
  if (!parsed) return <span className={className}>{value}</span>;
  const shown =
    typeof value === "number"
      ? Math.round(frame).toLocaleString("en-PH")
      : `${parsed.prefix}${formatCountUp(frame, parsed.decimals)}${parsed.suffix}`;
  return (
    <span className={`tabular-nums ${className ?? ""}`.trim()}>{shown}</span>
  );
}
