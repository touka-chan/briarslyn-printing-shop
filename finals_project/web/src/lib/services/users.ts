/**
 * Firestore service - users collection.
 *
 * Users/{uid} is the doc keyed by Firebase Auth uid. The doc carries the
 * role (Owner | Admin | POS_Cashier | Production Staff) and the profile
 * fields. There is NO `customers` collection - see SETUP_FIREBASE.md.
 */
import {
 collection,
 onSnapshot,
 doc,
 deleteDoc,
 getDoc,
 getDocs,
 limit,
 query,
 setDoc,
 updateDoc,
 where,
 Timestamp,
 type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import { logAudit } from "@/lib/services/audit";
import type { User } from "@/types";

const COLL = "users";

/**
 * Strip `undefined` fields from an object so it's safe to pass to
 * Firestore. Firestore rejects `undefined` values (`Unsupported field
 * value: undefined`) but accepts `null` or omitted fields. The address
 * cascade in `AddressCascade.tsx` deliberately sets fields to `undefined`
 * when the user changes a higher-level option (e.g. picking a new
 * region clears the previously-picked province/city/barangay), so the
 * value held in form state may contain `undefined` properties. This
 * helper runs recursively on plain objects to clean up nested values
 * too - addresses can be deeply nested in custom shapes.
 *
 * Returns `undefined` if every field is gone after stripping, so
 * callers can use `?? null` to keep the field present-but-empty in
 * the doc.
 */
export function stripUndefined<T>(value: T | undefined | null): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let any = false;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      const cleaned = stripUndefined(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
      any = true;
    }
    return (any ? out : undefined) as T;
  }
  return value;
}

/** Firestore subscription failure handler (permission/offline). */
export type FeedErrorHandler = (e: unknown) => void;

function logFeedError(scope: string): FeedErrorHandler {
  return (e) => {
    console.error(`[${scope}] subscription failed:`, e);
  };
}

export function subscribeUsers(
  cb: (users: User[]) => void,
  onError: FeedErrorHandler = logFeedError("users"),
): Unsubscribe {
  return onSnapshot(collection(requireDb(), COLL), (snap) => {
    const users = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(users);
  }, onError);
}

export function subscribeUser(
  uid: string,
  cb: (user: User | null) => void,
  onError: FeedErrorHandler = logFeedError("users"),
): Unsubscribe {
  return onSnapshot(doc(requireDb(), COLL, uid), (snap) => {
    cb(snap.exists() ? fromFirestore(snap.id, snap.data()) : null);
  }, onError);
}

export async function createUser(input: {
  uid: string;
  email: string;
  name: string;
  role: User["role"];
  status?: User["status"];
  address?: User["address"];
}): Promise<void> {
  await setDoc(doc(requireDb(), COLL, input.uid), {
    email: input.email,
    name: input.name,
    role: input.role,
    status: input.status ?? "active",
    address: stripUndefined(input.address) ?? null,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    last_login_at: null,
  });
  logAudit({
   action: "user_created",
   module: "users",
   record_id: input.uid,
   record_label: `User ${input.name} (${input.email})`,
   old_value: null,
   new_value: `role=${input.role}, status=${input.status ?? "active"}`,
  });
}

export async function updateUser(
  uid: string,
  patch: Partial<Pick<User, "name" | "role" | "status" | "address">>,
): Promise<void> {
  const prevSnap = await getDoc(doc(requireDb(), COLL, uid)).catch(() => null);
  const prev = prevSnap?.data() as Record<string, unknown> | undefined;
  await updateDoc(doc(requireDb(), COLL, uid), {
    ...patch,
    updated_at: Timestamp.now(),
  });
  const label = `User ${(prev?.name as string) ?? uid}`;
  if (patch.role !== undefined && patch.role !== prev?.role) {
   logAudit({
    action: "user_role_updated",
    module: "users",
    record_id: uid,
    record_label: label,
    old_value: (prev?.role as string) ?? null,
    new_value: patch.role,
   });
  }
  if (patch.status !== undefined && patch.status !== prev?.status) {
   logAudit({
    action: "user_status_updated",
    module: "users",
    record_id: uid,
    record_label: label,
    old_value: (prev?.status as string) ?? null,
    new_value: patch.status,
   });
  }
}

/**
 * Delete a sign-in profile doc. Used when an archived employee is
 * permanently removed: without a users/{uid} doc the account cannot pass
 * AuthGate ("Profile not found"). WARNING: mobile self-heals missing docs
 * by auto-provisioning, so the Firebase Auth account itself must ALSO be
 * removed in the Firebase Console - the UI says so after delete. Client
 * SDKs cannot delete other users' Auth accounts.
 */
export async function deleteUser(uid: string): Promise<void> {
  await deleteDoc(doc(requireDb(), COLL, uid));
}

export async function deactivateUser(uid: string): Promise<void> {
  const prevSnap = await getDoc(doc(requireDb(), COLL, uid)).catch(() => null);
  const prev = prevSnap?.data() as Record<string, unknown> | undefined;
  await updateDoc(doc(requireDb(), COLL, uid), {
    status: "inactive",
    updated_at: Timestamp.now(),
  });
  logAudit({
   action: "user_status_updated",
   module: "users",
   record_id: uid,
   record_label: `User ${(prev?.name as string) ?? uid}`,
   old_value: (prev?.status as string) ?? null,
   new_value: "inactive",
  });
}

export async function recordLogin(uid: string): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, uid), {
    last_login_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
}

/**
 * Find a sign-in account by email (employee <-> users link for
 * archive/deactivate login blocking). Returns the uid or null.
 */
export async function findUserByEmail(email: string): Promise<string | null> {
  const q = query(
    collection(requireDb(), COLL),
    where("email", "==", email),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
}

/**
 * Account lookup for the web forgot-password flow: uid (existence
 * gate), stored display name (personalises the reset email) and role.
 *
 * The web panel only serves Owner/Admin accounts - Cashier and
 * Production accounts reset their password from the mobile app - so
 * the caller uses `role` to gate the request.
 */
export async function findUserForPasswordReset(
  email: string,
): Promise<{ uid: string; name: string; role: User["role"] } | null> {
  const q = query(
    collection(requireDb(), COLL),
    where("email", "==", email),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return {
    uid: snap.docs[0].id,
    name: ((data.name as string) ?? "").trim(),
    role: (data.role as User["role"]) ?? "POS_Cashier",
  };
}

// ---- internal helpers ----

function fromFirestore(uid: string, data: Record<string, unknown>): User {
  return {
    id: uid,
    uid,
    email: (data.email as string) ?? "",
    name: (data.name as string) ?? "",
    role: (data.role as User["role"]) ?? "POS_Cashier",
    status: (data.status as User["status"]) ?? "active",
    address: (data.address as User["address"]) ?? undefined,
    lastLogin: fromTimestamp(data.last_login_at),
  };
}

function fromTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}
