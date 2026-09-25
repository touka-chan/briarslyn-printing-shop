"use client";

import { useEffect, useState } from "react";
import { subscribeSensors, type SensorState } from "@/lib/services/rfid";

/**
 * Live sensor status chip for the header.
 *
 * Subscribes to the `sensors` collection (the ESP32 / Apps Script writes
 * `online`/`is_online`, `tap_mode`, and `last_seen_at` on every ping or
 * tap) and re-evaluates on a 30s tick, so a station that stops reporting
 * flips from Live to Idle without a page reload.
 *
 *   Live         online and reported within the last 10 minutes
 *   Idle         online but no activity for over 10 minutes
 *   Offline      flagged offline, or no sensor doc exists yet
 *   Unavailable  the sensors feed failed (network/permission)
 *
 * The tooltip carries the sensor id, tap mode, and how long ago it was
 * last seen, so the raw state is always inspectable.
 */
const LIVE_WINDOW_MS = 10 * 60 * 1000;
const TICK_MS = 30 * 1000;

type Liveness = "live" | "idle" | "offline" | "unavailable";

const LABELS: Record<Liveness, string> = {
  live: "Sensor live",
  idle: "Sensor idle",
  offline: "Sensor offline",
  unavailable: "Sensor n/a",
};

const DOTS: Record<Liveness, string> = {
  live: "bg-[#17171c] dark:bg-white animate-pulse",
  idle: "bg-printflow-warning",
  offline: "bg-zinc-400",
  unavailable: "bg-zinc-300",
};

function agoLabel(ms: number): string {
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SensorStatus() {
 const [sensors, setSensors] = useState<Record<string, SensorState> | null>(null);
 const [unavailable, setUnavailable] = useState(false);
 const [now, setNow] = useState(() => Date.now());

 useEffect(() => {
  const unsub = subscribeSensors(
   (next) => {
    setSensors(next);
    setUnavailable(false);
   },
   () => setUnavailable(true),
  );
  return unsub;
 }, []);

 // Drives the "last seen" / staleness label between Firestore snapshots.
 useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), TICK_MS);
  return () => clearInterval(id);
 }, []);

 const entries = sensors ? Object.entries(sensors) : [];
 const primary =
  entries.find(([id]) => id === "ESP32-01") ?? entries[0];
 const [sensorId, sensor] = primary ?? [];
 const lastSeenMs = sensor?.lastSeenAt ? Date.parse(sensor.lastSeenAt) : NaN;

 let liveness: Liveness;
 if (unavailable) liveness = "unavailable";
 else if (!sensor || !sensor.online) liveness = "offline";
 else if (Number.isFinite(lastSeenMs) && now - lastSeenMs > LIVE_WINDOW_MS)
  liveness = "idle";
 else liveness = "live";

 const title = (() => {
  if (liveness === "unavailable")
   return "Sensor feed unavailable - it will retry automatically";
  if (!sensor) return "No sensor registered yet (sensors collection is empty)";
  const parts = [sensorId ?? "sensor"];
  if (sensor.tapMode) parts.push(`mode: ${sensor.tapMode}`);
  parts.push(
   Number.isFinite(lastSeenMs)
    ? `last seen ${agoLabel(now - lastSeenMs)}`
    : "no activity yet",
  );
  if (liveness === "idle")
   parts.push(`no activity for over ${LIVE_WINDOW_MS / 60_000}m`);
  return parts.join(" - ");
 })();

 return (
  <div
   role="status"
   aria-live="polite"
   aria-label={title}
   title={title}
   className="hidden lg:inline-flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-full border border-printflow-outline-variant/60 bg-printflow-surface-container"
  >
   <span className={`w-2 h-2 rounded-full shrink-0 ${DOTS[liveness]}`} aria-hidden />
   <span className="text-xs font-medium text-printflow-on-surface-variant whitespace-nowrap">
    {LABELS[liveness]}
   </span>
  </div>
 );
}
