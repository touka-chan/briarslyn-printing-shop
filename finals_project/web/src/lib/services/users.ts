/**
 * Firestore service — users collection.
 *
 * Users/{uid} is the doc keyed by Firebase Auth uid. The doc carries the
 * role (Owner | Admin | POS_Cashier | Production Staff) and the profile
 * fields. There is NO `customers` collection — see SETUP_FIREBASE.md.
 */
import {
 collection,
 onSnapshot,
 doc,
 setDoc,
 updateDoc,
 Timestamp,
 type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
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
 * too — addresses can be deeply nested in custom shapes.
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

export function subscribeUsers(cb: (users: User[]) => void): Unsubscribe {
  return onSnapshot(collection(requireDb(), COLL), (snap) => {
    const users = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(users);
  });
}

export function subscribeUser(
  uid: string,
  cb: (user: User | null) => void,
): Unsubscribe {
  return onSnapshot(doc(requireDb(), COLL, uid), (snap) => {
    cb(snap.exists() ? fromFirestore(snap.id, snap.data()) : null);
  });
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
}

export async function updateUser(
  uid: string,
  patch: Partial<Pick<User, "name" | "role" | "status" | "address">>,
): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, uid), {
    ...patch,
    updated_at: Timestamp.now(),
  });
}

export async function deactivateUser(uid: string): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, uid), {
    status: "inactive",
    updated_at: Timestamp.now(),
  });
}

export async function recordLogin(uid: string): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, uid), {
    last_login_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
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
