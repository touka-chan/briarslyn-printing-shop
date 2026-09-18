/**
 * Audit trail - append-only `audit_logs` collection.
 *
 * Every mutating service calls {@link logAudit} fire-and-forget after a
 * successful write. Logging NEVER throws and never blocks the user action:
 * failures are swallowed to a console warning (the business write already
 * committed; a dead audit write must not fail it).
 *
 * Integrity comes from `firestore.rules`, not this file: clients may only
 * create well-formed entries as themselves (`actor_uid == auth.uid`), never
 * update/delete, and only Owner may read.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, requireDb } from "@/lib/firebase";
import type {
  AuditAction,
  AuditLogEntry,
  AuditModule,
  AuditSource,
  User,
} from "@/types";

const COLL = "audit_logs";
const DEFAULT_LIMIT = 500;

export type FeedErrorHandler = (e: unknown) => void;

function logFeedError(scope: string): FeedErrorHandler {
  return (e) => {
    console.error(`[${scope}] subscription failed:`, e);
  };
}

// ---- actor + IP resolution (cached, best-effort) ----------------------

let cachedRole: { uid: string; role: User["role"]; at: number } | null = null;
const ROLE_TTL_MS = 5 * 60 * 1000;

async function resolveRole(
  uid: string,
): Promise<User["role"] | "unknown"> {
  const now = Date.now();
  if (cachedRole && cachedRole.uid === uid && now - cachedRole.at < ROLE_TTL_MS) {
    return cachedRole.role;
  }
  try {
    const snap = await getDoc(doc(requireDb(), "users", uid));
    const role = (snap.data()?.role as User["role"] | undefined) ?? "unknown";
    if (role !== "unknown") cachedRole = { uid, role, at: now };
    return role;
  } catch {
    return cachedRole && cachedRole.uid === uid ? cachedRole.role : "unknown";
  }
}

let cachedIp: string | null | undefined;
async function resolveIp(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`ipify ${res.status}`);
    const data = (await res.json()) as { ip?: unknown };
    cachedIp = typeof data.ip === "string" ? data.ip : null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

export interface AuditActor {
  uid: string;
  email: string;
  name: string;
  role: User["role"] | "unknown";
}

/** Resolve the current Firebase user into an audit actor (never throws). */
export async function resolveActor(): Promise<AuditActor | null> {
  try {
    const user = auth?.currentUser;
    if (!user) return null;
    const role = await resolveRole(user.uid);
    return {
      uid: user.uid,
      email: user.email ?? "",
      name: user.displayName ?? "",
      role,
    };
  } catch {
    return null;
  }
}

// ---- write -------------------------------------------------------------

export interface LogAuditInput {
  action: AuditAction;
  module: AuditModule;
  record_id: string;
  record_label: string;
  old_value?: string | number | null;
  new_value?: string | number | null;
  source?: AuditSource;
  /** Override actor (tests / system flows). Defaults to current user. */
  actor?: AuditActor | null;
}

/**
 * Append one audit entry. Fire-and-forget: returns immediately, never
 * rejects. Callers should NOT await (or `void` it) so logging can never
 * gate the user action.
 */
export function logAudit(input: LogAuditInput): void {
  void (async () => {
    try {
      const actor = input.actor ?? (await resolveActor());
      if (!actor) return; // signed out - nothing attributable to log
      const ip = await resolveIp();
      await addDoc(collection(requireDb(), COLL), {
        actor_uid: actor.uid,
        actor_email: actor.email,
        actor_name: actor.name,
        actor_role: actor.role,
        action: input.action,
        module: input.module,
        record_id: input.record_id,
        record_label: input.record_label,
        old_value: input.old_value ?? null,
        new_value: input.new_value ?? null,
        source: input.source ?? "web",
        ip,
        created_at: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[audit] log write failed:", e);
    }
  })();
}

// ---- read (Owner only - enforced by rules + page gate) ------------------

function fromFirestore(id: string, data: Record<string, unknown>): AuditLogEntry {
  const ts = data.created_at;
  let created: string | undefined;
  if (typeof ts === "string") created = ts;
  else if (ts && typeof ts === "object" && "toDate" in ts) {
    try {
      created = (ts as { toDate: () => Date }).toDate().toISOString();
    } catch {
      created = undefined;
    }
  }
  return {
    id,
    actor_uid: (data.actor_uid as string) ?? "",
    actor_email: (data.actor_email as string) ?? "",
    actor_name: (data.actor_name as string) ?? "",
    actor_role: (data.actor_role as AuditLogEntry["actor_role"]) ?? "unknown",
    action: data.action as AuditAction,
    module: data.module as AuditModule,
    record_id: (data.record_id as string) ?? "",
    record_label: (data.record_label as string) ?? "",
    old_value: (data.old_value as string | number | null) ?? null,
    new_value: (data.new_value as string | number | null) ?? null,
    source: (data.source as AuditSource) ?? "web",
    ip: (data.ip as string | null) ?? null,
    created_at: created,
  };
}

export function subscribeAuditLogs(
  cb: (rows: AuditLogEntry[]) => void,
  max = DEFAULT_LIMIT,
  onError: FeedErrorHandler = logFeedError("audit"),
): Unsubscribe {
  const q = query(
    collection(requireDb(), COLL),
    orderBy("created_at", "desc"),
    limit(max),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => fromFirestore(d.id, d.data()))),
    onError,
  );
}

// ---- display helpers ----------------------------------------------------

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  order_created: "Order Created",
  order_status_updated: "Order Status Updated",
  order_cancelled: "Order Cancelled",
  payment_updated: "Payment Updated",
  stock_in: "Stock In",
  stock_usage: "Stock Usage Logged",
  stock_deducted_auto: "Stock Deducted (Auto)",
  stock_adjusted: "Stock Adjusted",
  reorder_point_updated: "Reorder Point Updated",
  variant_created: "Variant Created",
  variant_deleted: "Variant Deleted",
  user_created: "User Created",
  user_role_updated: "User Role Updated",
  user_status_updated: "User Status Updated",
  user_login: "User Login",
  user_logout: "User Logout",
  sensor_toggled: "Sensor Toggled",
  employee_archived: "Employee Archived",
  employee_unarchived: "Employee Unarchived",
  employee_deleted: "Employee Deleted",
};

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  orders: "Orders",
  inventory: "Inventory",
  payments: "Payments",
  users: "Users",
  auth: "Auth",
  forecasting: "Forecasting",
  employees: "Employees",
  system: "System",
};

export function formatAuditValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}
