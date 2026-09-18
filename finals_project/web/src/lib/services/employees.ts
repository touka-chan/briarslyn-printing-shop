/**
 * Firestore service - employees collection.
 *
 * Employees/{id} is a doc that holds the HR record of a team member. It is
 * separate from the `users` collection on purpose: an Employee entry is
 * information only (no Auth account, no password, no sign-in). Use the
 * /users page when you need to provision an account that can actually
 * sign in to the app.
 *
 * Doc id is a Firestore auto-id. The doc also carries a human-readable
 * `employee_id` (e.g. "EMP-0001") for display in tables.
 */
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  getDocs,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/services/users";
import type {
  Employee,
  EmployeeRole,
  EmployeeGender,
  UserAddress,
} from "@/types";

const COLL = "employees";

/**
 * Compute the next "EMP-NNNN" id by scanning existing docs. This is racy
 * under high concurrency but fine for a single-admin web UI. The format
 * is fixed-width zero-padded to 4 digits.
 */
async function nextEmployeeId(): Promise<string> {
  const db = requireDb();
  const snap = await getDocs(query(collection(db, COLL), orderBy("employee_id", "desc")));
  let max = 0;
  for (const d of snap.docs) {
    const raw = (d.data().employee_id as string) ?? "";
    const m = raw.match(/EMP-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

/** Firestore subscription failure handler (permission/offline). */
export type FeedErrorHandler = (e: unknown) => void;

function logFeedError(scope: string): FeedErrorHandler {
  return (e) => {
    console.error(`[${scope}] subscription failed:`, e);
  };
}

export function subscribeEmployees(
  cb: (employees: Employee[]) => void,
  onError: FeedErrorHandler = logFeedError("employees"),
): Unsubscribe {
  return onSnapshot(collection(requireDb(), COLL), (snap) => {
    const employees = snap.docs.map((d) => fromFirestore(d.id, d.data()));
    cb(employees);
  }, onError);
}

export function subscribeEmployee(
  id: string,
  cb: (employee: Employee | null) => void,
  onError: FeedErrorHandler = logFeedError("employees"),
): Unsubscribe {
  return onSnapshot(doc(requireDb(), COLL, id), (snap) => {
    cb(snap.exists() ? fromFirestore(snap.id, snap.data()) : null);
  }, onError);
}

export interface CreateEmployeeInput {
  fname: string;
  initial?: string;
  lname: string;
  contact_number: string;
  /** ISO YYYY-MM-DD. The on-document source of truth; `age` is derived from this. */
  birthdate: string;
  gender: EmployeeGender;
  address?: UserAddress;
  role: EmployeeRole;
  status?: "active" | "inactive";
  /** Sign-in account link (email known upfront; uid stamped after the
   * Auth account exists). Enables archive/deactivate login blocking. */
  email?: string;
  uid?: string;
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<{ id: string; employee_id: string }> {
  const employee_id = await nextEmployeeId();
  const ref = await addDoc(collection(requireDb(), COLL), {
    employee_id,
    email: input.email ?? null,
    uid: input.uid ?? null,
    archived: false,
    fname: input.fname,
    initial: input.initial ?? "",
    lname: input.lname,
    contact_number: input.contact_number,
    birthdate: input.birthdate,
    age: ageFromBirthdate(input.birthdate),
    gender: input.gender,
    address: stripUndefined(input.address) ?? null,
    role: input.role,
    status: input.status ?? "active",
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
  return { id: ref.id, employee_id };
}

export async function updateEmployee(
  id: string,
  patch: Partial<
    Pick<
      Employee,
      | "fname"
      | "initial"
      | "lname"
      | "contact_number"
      | "birthdate"
      | "age"
      | "gender"
      | "address"
      | "role"
      | "status"
      | "email"
      | "uid"
      | "archived"
    >
  >,
): Promise<void> {
  // If the patch updates `birthdate`, re-derive `age` so the two stay
  // consistent. If only `age` is patched, leave `birthdate` alone - but
  // the form always sends both, so this branch is mostly defensive.
  const next: Record<string, unknown> = { ...patch };
  if (typeof patch.birthdate === "string" && patch.birthdate.length > 0) {
    next.age = ageFromBirthdate(patch.birthdate);
  }
  await updateDoc(doc(requireDb(), COLL, id), {
    ...next,
    updated_at: Timestamp.now(),
  });
}

/**
 * Delete an HR record. Used as compensation when a later step of the
 * Add Employee flow fails while the admin session is still active
 * (employees writes require Owner/Admin, so this must run BEFORE the
 * SDK session swaps to the new account).
 */
export async function deleteEmployee(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), COLL, id));
}

export async function deactivateEmployee(id: string): Promise<void> {
  await updateDoc(doc(requireDb(), COLL, id), {
    status: "inactive",
    updated_at: Timestamp.now(),
  });
}

// ---- internal helpers ----

function fromFirestore(id: string, data: Record<string, unknown>): Employee {
  // Legacy rows may not have `birthdate` - keep showing the stored `age`.
  // New rows always have both; `age` is always derived from `birthdate`.
  const birthdateRaw = (data.birthdate as string | undefined) ?? "";
  const storedAge = typeof data.age === "number" ? data.age : 0;
  const age = birthdateRaw ? ageFromBirthdate(birthdateRaw) : storedAge;
  return {
    id,
    employee_id: (data.employee_id as string) ?? "",
    fname: (data.fname as string) ?? "",
    initial: ((data.initial as string) ?? "") || undefined,
    lname: (data.lname as string) ?? "",
    contact_number: (data.contact_number as string) ?? "",
    birthdate: birthdateRaw || undefined,
    age,
    gender: (data.gender as EmployeeGender) ?? "Prefer not to say",
    address: (data.address as UserAddress) ?? undefined,
    role: (data.role as EmployeeRole) ?? "POS_Cashier",
    status: (data.status as "active" | "inactive") ?? "active",
    email: (data.email as string) || undefined,
    uid: (data.uid as string) || undefined,
    archived: (data.archived as boolean) ?? false,
    created_at: fromTimestamp(data.created_at),
    updated_at: fromTimestamp(data.updated_at),
  };
}

/**
 * Compute the age (in completed years) from an ISO YYYY-MM-DD birthdate.
 * Returns 0 for empty/invalid input - callers should validate first.
 */
export function ageFromBirthdate(birthdate: string): number {
  if (!birthdate) return 0;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

function fromTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}
