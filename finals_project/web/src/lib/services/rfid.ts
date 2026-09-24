/**
 * Firestore service - rfid_events + sensors.
 *
 * The web reads both. Writes are service-account-only (the ESP32's job) -
 * the rules in `firestore.rules` reject client-side create/update on
 * `rfid_events`. The web only ever observes.
 */
import {
 collection,
 onSnapshot,
 query,
 where,
 orderBy,
 limit,
 doc,
 setDoc,
 Timestamp,
 type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import { markLocalActivity } from "@/lib/live-activity";
import type { RfidCheckoutEvent } from "@/types";

/** Firestore subscription failure handler (permission/offline). */
export type FeedErrorHandler = (e: unknown) => void;

function logFeedError(scope: string): FeedErrorHandler {
  return (e) => {
    console.error(`[${scope}] subscription failed:`, e);
  };
}

/** Subscribe to the latest N RFID events (most recent first). */
export function subscribeRfidEvents(
  cb: (events: RfidCheckoutEvent[]) => void,
  max = 50,
  onError: FeedErrorHandler = logFeedError("rfid"),
): Unsubscribe {
  const q = query(
    collection(requireDb(), "rfid_events"),
    orderBy("timestamp", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    const events = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(events);
  }, onError);
}

/** Subscribe to RFID events for a specific material variant, newest first. */
export function subscribeRfidEventsForVariant(
  materialVariantId: string,
  cb: (events: RfidCheckoutEvent[]) => void,
  max = 50,
  onError: FeedErrorHandler = logFeedError("rfid"),
): Unsubscribe {
  const q = query(
    collection(requireDb(), "rfid_events"),
    where("material_variant_id", "==", materialVariantId),
    orderBy("timestamp", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    const events = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(events);
  }, onError);
}

/** Live sensor state used by the header's live-activity diff. */
export interface SensorState {
  online: boolean;
  /** Mobile tap mode: 'check-in' | 'stock-in' | 'stock-out'. */
  tapMode?: string;
  lastSeenAt?: string;
}

/** Subscribe to the sensors map (sensorId - online/tapMode/lastSeen). */
export function subscribeSensors(
  cb: (sensors: Record<string, SensorState>) => void,
  onError?: FeedErrorHandler,
): Unsubscribe {
  return onSnapshot(collection(requireDb(), "sensors"), (snap) => {
    const out: Record<string, SensorState> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      out[d.id] = {
        // The mobile toggle writes `is_online`; the web console `online`.
        online:
          (data.is_online as boolean) ?? (data.online as boolean) ?? false,
        tapMode: (data.tap_mode as string) ?? undefined,
        lastSeenAt: fromTimestamp(data.last_seen_at),
      };
    });
    cb(out);
  }, onError);
}

/** Toggle a sensor's online state (production staff + admin only). */
export async function setSensorOnline(
  sensorId: string,
  online: boolean,
): Promise<void> {
  await setDoc(doc(requireDb(), "sensors", sensorId), {
    online,
    last_seen_at: Timestamp.now(),
  }, { merge: true });
  markLocalActivity("sensor", sensorId);
}

// ---- internal helpers ----

function fromFirestore(id: string, data: Record<string, unknown>): RfidCheckoutEvent {
  return {
    id,
    material_variant_id: (data.material_variant_id as string) ?? "",
    tag_uid: (data.tag_uid as string) ?? "",
    sensor_id: (data.sensor_id as string) ?? "",
    timestamp: fromTimestamp(data.timestamp) ?? new Date().toISOString(),
  };
}

function fromTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}
