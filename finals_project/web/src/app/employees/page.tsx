"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  Plus,
  Pencil,
  Shield,
  User as UserIcon,
  UserCheck,
  Phone,
  Hash,
  Cake,
  ChevronDown,
  Inbox,
  Briefcase,
  MapPin,
  UserPlus,
  IdCard,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Archive,
  ArchiveRestore,
  Power,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  DataTable,
  StatusBadge,
  Button,
  Modal,
  KpiCard,
  useToast,
  EmptyState,
  FeedErrorBanner,
} from "@/components/ui";
import { AddressCascade } from "@/components/forms";
import { useFeedStatus } from "@/lib/useFeedStatus";
import {
  subscribeEmployees,
  createEmployee,
  deleteEmployee,
  updateEmployee,
  ageFromBirthdate,
} from "@/lib/services/employees";
import {
  createUser,
  deactivateUser,
  deleteUser,
  findUserByEmail,
  subscribeUsers,
  updateUser,
} from "@/lib/services/users";
import { logAudit } from "@/lib/services/audit";
import { auth as firebaseAuth } from "@/lib/firebase";
import {
  beginAuthCreate,
  endAuthCreate,
} from "@/lib/auth-guard";
import {
  useSparkSeries,
  employeeCreatedAtKey,
} from "@/lib/hooks/useSparkSeries";
import type {
  Employee,
  EmployeeRole,
  EmployeeGender,
  UserAddress,
  User,
} from "@/types";

/**
 * Mirror of the old /users Add-User UX: creating a Firebase Auth
 * account via `createUserWithEmailAndPassword` swaps the SDK session
 * to the new account, so the admin has to re-authenticate before the
 * rest of the app trusts them again. The new account's email is
 * surfaced in the modal so the admin doesn't sign in to the wrong
 * person.
 */
interface CreatedAccount {
  uid: string;
  email: string;
  name: string;
}

function fullName(e: Employee): string {
  const parts = [e.fname, e.initial, e.lname].filter(Boolean);
  return parts.join(" ");
}

function formatAge(n: number | undefined): string {
  if (typeof n !== "number" || n <= 0) return "-";
  return String(n);
}

function formatDateCreated(iso: string | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Best-effort fallback: build an ISO YYYY-MM-DD that yields the given age
 * when re-computed by `ageFromBirthdate`. Used only to prefill the
 * birthdate input for legacy rows that don't have one stored. The result
 * is "approximately correct" (uses Jan 1 of the derived year) - the user
 * can correct it on edit.
 */
function deriveBirthdateFromAge(age: number | undefined): string {
  if (typeof age !== "number" || age <= 0) return "";
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create / edit form state
  const [fname, setFname] = useState("");
  const [initial, setInitial] = useState("");
  const [lname, setLname] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [birthdateVal, setBirthdateVal] = useState<string>("");
  const [genderVal, setGenderVal] = useState<EmployeeGender>("Prefer not to say");
  const [roleVal, setRoleVal] = useState<EmployeeRole>("POS_Cashier");
  const [statusVal, setStatusVal] = useState<"active" | "inactive">("active");
  const [addrVal, setAddrVal] = useState<UserAddress>({});

  // Sign-in account fields - only relevant in `mode === "create"`.
  // The Edit form does not show these because the Firebase Auth
  // credentials are immutable from this surface (we don't have the
  // Admin SDK, and rolling our own update-password flow is out of
  // scope for the HR page).
  const [emailVal, setEmailVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Re-sign-in admin state - shown after a successful create so the
  // admin can resume their own session. `currentAdmin` is captured
  // BEFORE createUserWithEmailAndPassword swaps the SDK session, so
  // we know who to sign back in as.
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<FirebaseUser | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [reauthing, setReauthing] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  const [kpiModal, setKpiModal] = useState<
   null | "all" | "Admin" | "POS_Cashier" | "Production Staff"
  >(null);
  // Sign-in accounts (employee <-> users link for login blocking).
  const [allUsers, setAllUsers] = useState<User[]>([]);
  // Confirm dialog: archive / unarchive / deactivate / activate.
  const [confirmAction, setConfirmAction] = useState<{
   kind: "archive" | "unarchive" | "deactivate" | "activate";
   emp: Employee;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Delete dialog (archived only): swal confirm + admin password.
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsub = subscribeEmployees(
     (rows) => {
       setEmployees(rows);
       setReady(true);
     },
     (e) => {
       onFeedError(e);
       // Never leave the page on a skeleton: render the error state.
       setReady(true);
     },
   );
   return () => unsub();
  }, [feedNonce, onFeedError]);

  useEffect(() => {
   const unsub = subscribeUsers(setAllUsers, onFeedError);
   return () => unsub();
  }, [feedNonce, onFeedError]);

  /**
   * Resolve the sign-in account linked to an employee: stored uid first,
   * then stored email, then a live lookup by the stored email (covers
   * accounts created before the link fields existed). Null = HR-only
   * record with no login to block.
   */
  const resolveLinkedUid = async (emp: Employee): Promise<string | null> => {
   if (emp.uid) return emp.uid;
   const email = (emp.email ?? "").trim().toLowerCase();
   if (!email) return null;
   const local = allUsers.find((u) => u.email.toLowerCase() === email);
   if (local) return local.id;
   try {
    return await findUserByEmail(email);
   } catch {
    return null;
   }
  };

  /**
   * Push an active/inactive state to the linked sign-in account. This is
   * what actually blocks (or restores) login: web AuthGate and mobile
   * `isLoggedIn` both require status "active". Returns false when there
   * is no linked account (HR record is still updated by the caller).
   * Silent by design - callers show exactly ONE toast (no stacked
   * "no linked account" + success pair).
   */
  const setLinkedUserStatus = async (
   emp: Employee,
   status: "active" | "inactive",
  ): Promise<boolean> => {
   const uid = await resolveLinkedUid(emp);
   if (!uid) return false;
   if (status === "inactive") await deactivateUser(uid);
   else await updateUser(uid, { status });
   return true;
  };

  // Live sparkline series - employees added per day for the last 7 days.
  const allEmployeesSeries = useSparkSeries(employees, employeeCreatedAtKey, 7);
  const adminSeries = useSparkSeries(
    employees.filter((e) => e.role === "Admin"),
    employeeCreatedAtKey,
    7,
  );
  const cashierSeries = useSparkSeries(
    employees.filter((e) => e.role === "POS_Cashier"),
    employeeCreatedAtKey,
    7,
  );
  const productionSeries = useSparkSeries(
    employees.filter((e) => e.role === "Production Staff"),
    employeeCreatedAtKey,
    7,
  );

  const handleSubmit = async () => {
    const fail = (msg: string) => {
      toast.error(msg);
      setFormError(msg);
    };
    setFormError(null);

    // Validation shared by create + edit
    if (!fname.trim()) {
      fail("First name is required");
      return;
    }
    if (!lname.trim()) {
      fail("Last name is required");
      return;
    }
    if (!contactNumber.trim()) {
      fail("Contact number is required");
      return;
    }
    if (!birthdateVal) {
      fail("Birthdate is required");
      return;
    }
    // Compute the age from the birthdate; the service re-derives it on
    // save, so this is just a sanity check before we round-trip.
    const computedAge = ageFromBirthdate(birthdateVal);
    if (computedAge < 16 || computedAge > 100) {
      fail("Birthdate must give an age between 16 and 100");
      return;
    }

    if (mode === "create") {
      // Sign-in account validation. Owner is intentionally not an option
      // here - the EmployeeRole type already excludes it, so the role
      // select can never produce "Owner" or an empty value. We only
      // need to validate the email and password fields.
      if (!emailVal.trim()) {
        fail("Email is required for the sign-in account");
        return;
      }
      // Lightweight email shape check - Firebase's createUser will
      // surface the canonical error if this passes but the address is
      // still malformed.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal.trim())) {
        fail("Enter a valid email address");
        return;
      }
      if (!passwordVal) {
        fail("Password is required for the sign-in account");
        return;
      }
      if (passwordVal.length < 8) {
        fail("Password must be at least 8 characters");
        return;
      }
      if (passwordVal !== confirmPasswordVal) {
        fail("Passwords do not match");
        return;
      }
      if (!firebaseAuth) {
        fail(
          "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in web/.env.local.",
        );
        return;
      }

      // Capture the admin BEFORE we swap the SDK session by calling
      // createUserWithEmailAndPassword. The re-sign-in modal needs to
      // know who to sign back in as.
      const adminBefore = firebaseAuth.currentUser;
      if (!adminBefore || !adminBefore.email) {
        fail("You must be signed in to add an employee");
        return;
      }

      setCreating(true);
      // Tell AuthGate to stand down for the duration of this create
      // flow. `createUserWithEmailAndPassword` atomically swaps the
      // SDK session (signOut the admin, then signIn the new user),
      // which makes `firebaseUser` flip to `null` for a moment. If
      // AuthGate sees that, it redirects to /login and the admin
      // never sees the re-sign-in modal. The guard is cleared in
      // every terminal path of the create flow below (success,
      // re-sign-in cancel, createUserWithEmailAndPassword error).
      beginAuthCreate();
      // Step 1 (as admin): write the employees/{id} HR doc FIRST.
      // employees writes require Owner/Admin, and the SDK session
      // swaps to the new (non-admin) account in step 2 - writing it
      // afterwards fails with "Missing or insufficient permissions".
      let employeeDocId: string | null = null;
      let employeeLabel = "";
      try {
        const created = await createEmployee({
          fname: fname.trim(),
          initial: initial.trim() || undefined,
          lname: lname.trim(),
          contact_number: contactNumber.trim(),
          birthdate: birthdateVal,
          gender: genderVal,
          address: addrVal,
          role: roleVal,
          status: statusVal,
          email: emailVal.trim() || undefined,
        });
        employeeDocId = created.id;
        employeeLabel = created.employee_id;
      } catch (e: unknown) {
        console.error("[AddEmployee] employees write failed:", e);
        fail(e instanceof Error ? e.message : "Failed to save the HR record");
        // Still admin - nothing swapped. Release the guard.
        endAuthCreate();
        setCreating(false);
        return;
      }
      try {
        // Step 2: create the Firebase Auth account. This swaps the SDK
        // session from the admin to the new account.
        const cred = await createUserWithEmailAndPassword(
          firebaseAuth,
          emailVal.trim(),
          passwordVal,
        );
        const newUid = cred.user.uid;

        try {
          // Step 3: write the users/{uid} doc (the auth-side profile).
          // Self-create is allowed, so this works as the new user.
          await createUser({
            uid: newUid,
            email: emailVal.trim(),
            name: `${fname.trim()} ${lname.trim()}`.trim(),
            role: roleVal,
            status: statusVal,
            address: addrVal,
          });
          // Stamp the sign-in link onto the HR doc so archive/deactivate
          // can later block this exact account's login.
          await updateEmployee(employeeDocId, {
            email: emailVal.trim(),
            uid: newUid,
          }).catch(() => {
            // Non-fatal: the account exists; the link can be matched by
            // email later via resolveLinkedUid.
          });

          // Step 4: hand off to the re-sign-in modal. We deliberately do
          // NOT call resetForm() or close the form modal yet - the
          // modal closes only after the admin re-authenticates, so
          // the admin can see what just happened if the re-sign-in
          // fails.
          setCurrentAdmin(adminBefore);
          setCreatedAccount({
            uid: newUid,
            email: emailVal.trim(),
            name: `${fname.trim()} ${lname.trim()}`.trim(),
          });
          setFormError(null);
          // Close the form modal - the re-sign-in modal takes over.
          setOpen(false);
          // Used only for the toast text in the success path.
          void employeeLabel;
          // NOTE: do NOT call endAuthCreate() here - the guard has to
          // stay up until the admin either re-signs in or cancels.
          // See handleConfirmReauth / handleCancelReauth below.
        } catch (innerErr: any) {
          console.error("[AddEmployee] inner catch (users write failed):", innerErr);
          console.error("[AddEmployee] inner err code:", innerErr?.code, "message:", innerErr?.message);
          // Compensating deletes: the HR doc from step 1 stays (it is
          // a truthful HR record), but roll back the Auth user so we
          // don't leave a ghost sign-in account with no profile doc.
          // (The HR doc can't be deleted anymore - that needs admin
          // and the session already swapped. The admin can remove it
          // from the roster if needed.)
          try {
            await cred.user.delete();
          } catch (deleteErr) {
            // Best-effort; if delete itself fails, surface the
            // original error and rely on the admin to clean up in
            // Firebase Console (Authentication + employees roster).
            console.error("compensating auth delete failed", deleteErr);
          }
          // The create flow is over (in failure). Release the
          // AuthGate guard so normal behavior resumes.
          endAuthCreate();
          throw innerErr;
        }
      } catch (e: any) {
        const code = e?.code as string | undefined;
        console.error("[AddEmployee] caught error:", e);
        console.error("[AddEmployee] error code:", code, "message:", e?.message);
        if (code === "auth/email-already-in-use") {
          // The HR doc from step 1 exists without an account - tell
          // the admin it can be reused (same email, retry with a
          // different address or delete the roster row first). Try to
          // clean it up since we're still admin here.
          if (employeeDocId) {
            await deleteEmployee(employeeDocId).catch((cleanupErr) => {
              console.error("[AddEmployee] HR cleanup failed", cleanupErr);
            });
          }
          fail("An account with that email already exists");
        } else if (code === "auth/invalid-email") {
          if (employeeDocId) {
            await deleteEmployee(employeeDocId).catch(() => {
              // ignore - admin can remove the roster row
            });
          }
          fail("Enter a valid email address");
        } else if (code === "auth/weak-password") {
          if (employeeDocId) {
            await deleteEmployee(employeeDocId).catch(() => {
              // ignore - admin can remove the roster row
            });
          }
          fail("Password is too weak - use at least 8 characters");
        } else {
          fail(e?.message ?? "Failed to add employee");
        }
        // Release the guard (the session never swapped in the
        // validation-failure branches; in the users-write branch the
        // inner catch already released it - calling twice is safe).
        endAuthCreate();
      } finally {
        setCreating(false);
      }
      return;
    }

    if (sel && mode === "edit") {
      setSaving(true);
      try {
        await updateEmployee(sel.id, {
          fname: fname.trim(),
          initial: initial.trim() || undefined,
          lname: lname.trim(),
          contact_number: contactNumber.trim(),
          birthdate: birthdateVal,
          gender: genderVal,
          role: roleVal,
          status: statusVal,
          address: addrVal,
        });
        toast.success(`Updated ${fullName(sel)}'s profile`);
        resetForm();
        setOpen(false);
        setSel(null);
      } catch (e: any) {
        fail(e?.message ?? "Failed to update employee");
      } finally {
        setSaving(false);
      }
    }
  };

  const resetForm = () => {
    setFname("");
    setInitial("");
    setLname("");
    setContactNumber("");
    setBirthdateVal("");
    setGenderVal("Prefer not to say");
    setRoleVal("POS_Cashier");
    setStatusVal("active");
    setAddrVal({});
    setEmailVal("");
    setPasswordVal("");
    setConfirmPasswordVal("");
    setShowPw(false);
    setShowConfirmPw(false);
    setFormError(null);
  };

  /**
   * Re-authenticate the admin after a successful create. The admin's
   * session was swapped to the new account when we called
   * createUserWithEmailAndPassword; this puts the admin back in
   * control so the rest of the app trusts them again.
   */
  const handleConfirmReauth = async () => {
    if (!firebaseAuth || !currentAdmin?.email) return;
    setReauthing(true);
    setReauthError(null);
    try {
      await signInWithEmailAndPassword(
        firebaseAuth,
        currentAdmin.email,
        adminPassword,
      );
      // Success - close everything and toast. The re-auth swapped
      // the SDK session back to the admin, so AuthGate's normal
      // behavior is safe to restore.
      const created = createdAccount;
      endAuthCreate();
      resetForm();
      setCreatedAccount(null);
      setCurrentAdmin(null);
      setAdminPassword("");
      if (created) {
        toast.success(`Added ${created.name} - ${created.email} can now sign in`);
      }
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setReauthError("Wrong password - try again");
      } else if (code === "auth/too-many-requests") {
        setReauthError("Too many attempts. Try again in a few minutes.");
      } else {
        setReauthError(e?.message ?? "Re-authentication failed");
      }
      // Wrong password / network blip - keep the guard up so the
      // admin stays on this page and can retry or cancel.
    } finally {
      setReauthing(false);
    }
  };

  /**
   * User chose to cancel the re-sign-in. Sign them out entirely so
   * they're not silently signed in as the new employee. The
   * AdminLayout's sign-out flow then handles the redirect.
   */
  const handleCancelReauth = async () => {
    if (firebaseAuth) {
      try {
        await fbSignOut(firebaseAuth);
      } catch {
        /* ignore */
      }
    }
    // Release the AuthGate guard BEFORE clearing local state so the
    // sign-out-triggered redirect to /login can fire normally. If we
    // cleared the guard after the state setters, AuthGate would
    // briefly see `firebaseUser === null` with the guard still up and
    // render the page tree unmounted before redirecting.
    endAuthCreate();
    // Surface the created account info via toast so the admin still
    // knows what happened before being redirected.
    if (createdAccount) {
      toast.info(
        `Account created for ${createdAccount.email}. You were signed out - sign in again to continue.`,
      );
    }
    setCreatedAccount(null);
    setCurrentAdmin(null);
    setAdminPassword("");
    setReauthError(null);
  };

  const tabs = useMemo(
    () => [
     {
      id: "All",
      label: "All",
      count: employees.filter((e) => !e.archived).length,
     },
     {
      id: "Admin",
      label: "Admin",
      count: employees.filter((e) => !e.archived && e.role === "Admin").length,
     },
     {
      id: "POS_Cashier",
      label: "POS/Cashier",
      count: employees.filter((e) => !e.archived && e.role === "POS_Cashier")
       .length,
     },
     {
      id: "Production Staff",
      label: "Production Staff",
      count: employees.filter((e) => !e.archived && e.role === "Production Staff")
       .length,
     },
     {
      id: "Archived",
      label: "Archived",
      count: employees.filter((e) => e.archived).length,
     },
    ],
    [employees],
  );

  const filtered = useMemo(() => {
    // Archived records live ONLY under the Archived tab - the roster and
    // role tabs show active staff. Archived staff cannot sign in.
    const visible =
     active === "Archived"
      ? employees.filter((e) => e.archived)
      : employees.filter((e) => !e.archived);
    const byRole =
     active === "All" || active === "Archived"
      ? visible
      : visible.filter((e) => e.role === active);
    if (!search) return byRole;
    const q = search.toLowerCase();
    return byRole.filter((e) => {
      const name = fullName(e).toLowerCase();
      return (
        name.includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.contact_number.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
      );
    });
  }, [employees, active, search]);

  const cols = [
    {
      key: "employee_id",
      header: "ID",
      render: (r: Employee) => (
        <span className="font-mono text-xs text-printflow-on-surface-variant">
          {r.employee_id || "-"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (r: Employee) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-printflow-on-surface truncate">
            {fullName(r)}
          </p>
          <p className="text-[12px] text-printflow-on-surface-variant truncate flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {r.contact_number}
          </p>
        </div>
      ),
    },
    {
      key: "age",
      header: "Age",
      className: "w-16",
      render: (r: Employee) => (
        <span className="text-sm text-printflow-on-surface">
          {formatAge(r.age)}
        </span>
      ),
    },
    {
      key: "gender",
      header: "Gender",
      render: (r: Employee) => (
        <span className="text-sm text-printflow-on-surface">
          {r.gender}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (r: Employee) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs bg-printflow-primary-fixed/20 text-printflow-primary">
          {r.role}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r: Employee) => <StatusBadge status={r.status} />,
    },
    {
      key: "created_at",
      header: "Date Created",
      render: (r: Employee) => (
        <span className="text-sm text-printflow-on-surface-variant whitespace-nowrap">
          {formatDateCreated(r.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r: Employee) =>
        active === "Archived" ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title="Unarchive (restores roster + login)"
              onClick={() => setConfirmAction({ kind: "unarchive", emp: r })}
              className="p-1.5 rounded-lg text-printflow-primary hover:bg-printflow-surface-container transition-colors"
            >
              <ArchiveRestore className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Delete permanently"
              onClick={() => {
                setDeleteTarget(r);
                setDeletePassword("");
                setDeleteError(null);
              }}
              className="p-1.5 rounded-lg text-printflow-error hover:bg-printflow-error/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title="Edit"
              onClick={() => openEdit(r)}
              className="p-1.5 rounded-lg text-printflow-on-surface-variant hover:bg-printflow-surface-container hover:text-printflow-on-surface transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              title={r.status === "active" ? "Deactivate (blocks login)" : "Reactivate"}
              onClick={() =>
                setConfirmAction({
                  kind: r.status === "active" ? "deactivate" : "activate",
                  emp: r,
                })
              }
              className="p-1.5 rounded-lg text-printflow-on-surface-variant hover:bg-printflow-surface-container hover:text-printflow-on-surface transition-colors"
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Archive (hides from roster, blocks login)"
              onClick={() => setConfirmAction({ kind: "archive", emp: r })}
              className="p-1.5 rounded-lg text-printflow-on-surface-variant hover:bg-printflow-surface-container hover:text-printflow-on-surface transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        ),
    },
  ];

  const inputBase =
    "w-full pl-10 pr-4 py-2.5 text-sm bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/40 focus:bg-printflow-surface focus:border-printflow-primary focus:ring-4 focus:ring-printflow-primary/10 focus:outline-none transition-all placeholder:text-printflow-on-surface-variant/50";
  const labelCls =
    "text-[12px] font-medium tracking-wide text-printflow-on-surface-variant";

  const kpiFilteredEmployees = useMemo(() => {
    if (kpiModal === null) return [] as Employee[];
    if (kpiModal === "all") return employees;
    return employees.filter((e) => e.role === kpiModal);
  }, [kpiModal, employees]);

  const kpiMeta: Record<
    NonNullable<typeof kpiModal>,
    { title: string; desc: string; icon: ReactNode; count: number }
  > = {
    all: {
      title: "All Employees",
      desc: `${kpiFilteredEmployees.length} employees across all roles`,
      icon: <Briefcase className="w-5 h-5" />,
      count: kpiFilteredEmployees.length,
    },
    Admin: {
      title: "Admin Employees",
      desc: `${kpiFilteredEmployees.length} employees with admin duties`,
      icon: <Shield className="w-5 h-5" />,
      count: kpiFilteredEmployees.length,
    },
    POS_Cashier: {
      title: "POS / Cashier Employees",
      desc: `${kpiFilteredEmployees.length} employees on the front-of-house team`,
      icon: <UserCheck className="w-5 h-5" />,
      count: kpiFilteredEmployees.length,
    },
    "Production Staff": {
      title: "Production Staff",
      desc: `${kpiFilteredEmployees.length} employees on the production floor`,
      icon: <UserIcon className="w-5 h-5" />,
      count: kpiFilteredEmployees.length,
    },
  };

  const employeeKpiColumns: {
    key: keyof Employee | "actions";
    header: string;
    className?: string;
    render?: (r: Employee) => ReactNode;
  }[] = [
    {
      key: "employee_id",
      header: "ID",
      render: (r) => (
        <span className="font-mono text-xs text-printflow-on-surface-variant">
          {r.employee_id || "-"}
        </span>
      ),
    },
    {
      key: "lname",
      header: "Name",
      render: (r) => fullName(r),
    },
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs bg-printflow-primary-fixed/20 text-printflow-primary">
          {r.role}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "created_at",
      header: "Date Created",
      render: (r) => (
        <span className="text-sm text-printflow-on-surface-variant whitespace-nowrap">
          {formatDateCreated(r.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: () => (
        <Pencil className="w-4 h-4 text-printflow-on-surface-variant" />
      ),
    },
  ];

  /**
   * Single close path for the form modal - used by the X button,
   * the Cancel button, the backdrop click, and the Escape key. It
   * resets every form field so the next open starts clean. The
   * re-sign-in modal is owned separately (see `createdAccount`).
   */
  const closeForm = () => {
    if (saving || creating) return;
    resetForm();
    setOpen(false);
    setSel(null);
  };

  const openCreate = () => {
    setSel(null);
    setMode("create");
    resetForm();
    setOpen(true);
  };

  const openEdit = (r: Employee) => {
    setSel(r);
    setMode("edit");
    setFname(r.fname);
    setInitial(r.initial ?? "");
    setLname(r.lname);
    setContactNumber(r.contact_number);
    // Prefer the stored birthdate; fall back to deriving one from `age`
    // for legacy rows written before the field was added.
    setBirthdateVal(r.birthdate ?? deriveBirthdateFromAge(r.age));
    setGenderVal(r.gender);
    setRoleVal(r.role);
    setStatusVal(r.status);
    setAddrVal(r.address ?? {});
    // The Edit form never shows the sign-in fields, but clear them
    // defensively so a Cancel-after-Edit doesn't leave values behind.
    setEmailVal("");
    setPasswordVal("");
    setConfirmPasswordVal("");
    setShowPw(false);
    setShowConfirmPw(false);
    setFormError(null);
    setOpen(true);
  };

  const openView = (r: Employee) => {
    setSel(r);
    setMode("view");
    setOpen(true);
  };

  /**
   * Archive / unarchive / deactivate / reactivate executor (confirm modal).
   * Status changes propagate to the linked sign-in account so login is
   * blocked (or restored) immediately: web AuthGate and mobile
   * `isLoggedIn` both require status "active". Archived records always
   * carry status "inactive".
   */
  const runConfirmAction = async () => {
    if (!confirmAction || confirmBusy) return;
    const { kind, emp } = confirmAction;
    setConfirmBusy(true);
    try {
      const name = fullName(emp);
      // Exactly ONE toast per action - append the no-link note instead
      // of firing a second toast.
      const linkedNote = (linked: boolean) =>
        linked ? "" : " (no linked sign-in account - roster updated only)";
      if (kind === "archive") {
        await updateEmployee(emp.id, { archived: true, status: "inactive" });
        const linked = await setLinkedUserStatus(
          { ...emp, status: "inactive" },
          "inactive",
        );
        logAudit({
          action: "employee_archived",
          module: "employees",
          record_id: emp.id,
          record_label: `Employee ${name} (${emp.employee_id})`,
          old_value: "active",
          new_value: "archived",
        });
        toast.success(`${name} archived - sign-in blocked${linkedNote(linked)}`);
      } else if (kind === "unarchive") {
        await updateEmployee(emp.id, { archived: false, status: "active" });
        const linked = await setLinkedUserStatus(
          { ...emp, status: "active" },
          "active",
        );
        logAudit({
          action: "employee_unarchived",
          module: "employees",
          record_id: emp.id,
          record_label: `Employee ${name} (${emp.employee_id})`,
          old_value: "archived",
          new_value: "active",
        });
        toast.success(`${name} restored - sign-in enabled${linkedNote(linked)}`);
      } else if (kind === "deactivate") {
        await updateEmployee(emp.id, { status: "inactive" });
        const linked = await setLinkedUserStatus(
          { ...emp, status: "inactive" },
          "inactive",
        );
        logAudit({
          action: "user_status_updated",
          module: "employees",
          record_id: emp.id,
          record_label: `Employee ${name} (${emp.employee_id})`,
          old_value: "active",
          new_value: "inactive",
        });
        toast.success(`${name} deactivated - sign-in blocked${linkedNote(linked)}`);
      } else {
        await updateEmployee(emp.id, { status: "active" });
        const linked = await setLinkedUserStatus(
          { ...emp, status: "active" },
          "active",
        );
        logAudit({
          action: "user_status_updated",
          module: "employees",
          record_id: emp.id,
          record_label: `Employee ${name} (${emp.employee_id})`,
          old_value: "inactive",
          new_value: "active",
        });
        toast.success(`${name} reactivated${linkedNote(linked)}`);
      }
      setConfirmAction(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setConfirmBusy(false);
    }
  };

  /**
   * Permanent delete (Archived tab only). Requires the signed-in admin's
   * own password (reauthentication) plus an explicit typed confirmation
   * in the swal-style modal. Removes the HR doc and the linked sign-in
   * profile; the Firebase Auth account itself must be removed in the
   * Firebase Console (client SDKs cannot delete other users) - the
   * success toast says so.
   */
  const runDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    const emp = deleteTarget;
    const adminEmail = firebaseAuth?.currentUser?.email;
    if (!adminEmail) {
      setDeleteError("You must be signed in to delete");
      return;
    }
    if (!deletePassword) {
      setDeleteError("Enter your password to confirm");
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const cred = EmailAuthProvider.credential(adminEmail, deletePassword);
      const user = firebaseAuth?.currentUser;
      if (!user) throw new Error("You must be signed in to delete");
      await reauthenticateWithCredential(user, cred);
      const uid = await resolveLinkedUid(emp);
      if (uid) {
        await deleteUser(uid).catch(() => {
          // Non-fatal: HR doc removal below still proceeds; the orphan
          // profile can be removed from the Users page.
        });
      }
      await deleteEmployee(emp.id);
      logAudit({
        action: "employee_deleted",
        module: "employees",
        record_id: emp.id,
        record_label: `Employee ${fullName(emp)} (${emp.employee_id})`,
        old_value: "archived",
        new_value: null,
      });
      setDeleteTarget(null);
      setDeletePassword("");
      toast.success(
        `${fullName(emp)} deleted. Also remove their Auth account in the Firebase Console.`,
      );
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      setDeleteError(
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Wrong password - try again"
          : e instanceof Error
            ? e.message
            : "Delete failed",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const modalIcon =
    mode === "create" ? (
      <UserPlus className="w-5 h-5" />
    ) : mode === "edit" ? (
      <Pencil className="w-5 h-5" />
    ) : (
      <IdCard className="w-5 h-5" />
    );
  const modalTitle =
    mode === "create"
      ? "Add Employee"
      : mode === "edit"
        ? `Edit ${sel ? fullName(sel) : "Employee"}`
        : sel
          ? fullName(sel)
          : "Employee";
  const modalDesc =
    mode === "create"
      ? "Add a new employee - creates the HR record and a sign-in account"
      : mode === "edit"
        ? "Update employee HR details, contact, and role"
        : sel
          ? `${sel.role} - ${sel.employee_id}`
          : undefined;

  return (
    <AdminLayout
      title="Employees"
      subtitle="Employee HR records - profiles, contact info, roles, and addresses"
      onSearch={setSearch}
    >
      {feedError && (
        <FeedErrorBanner
          message={feedError}
          showCached={employees.length > 0}
          onRetry={retryFeed}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Employees"
          value={employees.length}
          icon="User"
          sparkline={allEmployeesSeries}
          sparklineTone="primary"
          lastUpdated="Live"
          onClick={() => setKpiModal("all")}
          loading={!ready}
        />
        <KpiCard
          label="Admin"
          value={employees.filter((e) => e.role === "Admin").length}
          icon="Shield"
          sparkline={adminSeries}
          sparklineTone="primary"
          lastUpdated="Live"
          onClick={() => setKpiModal("Admin")}
          loading={!ready}
        />
        <KpiCard
          label="POS/Cashier"
          value={employees.filter((e) => e.role === "POS_Cashier").length}
          icon="UserCheck"
          sparkline={cashierSeries}
          sparklineTone="success"
          lastUpdated="Live"
          onClick={() => setKpiModal("POS_Cashier")}
          loading={!ready}
        />
        <KpiCard
          label="Production Staff"
          value={
            employees.filter((e) => e.role === "Production Staff").length
          }
          icon="User"
          sparkline={productionSeries}
          sparklineTone="warning"
          lastUpdated="Live"
          onClick={() => setKpiModal("Production Staff")}
          loading={!ready}
        />
      </div>

      <ContentCard
        title="Team Roster"
        subtitle={`${filtered.length} employees`}
      >
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs text-printflow-on-surface-variant mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, contact, or role"
              className="w-full px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-printflow-on-surface-variant mb-1">
              Role
            </label>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value)}
              className="px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
            >
              {tabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === "All" ? `All (${t.count})` : `${t.label} (${t.count})`}
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add Employee
          </Button>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<Inbox className="w-7 h-7" />}
              title="No employees"
              description="Add an employee record to get started."
            />
          </div>
        ) : (
          <DataTable
            columns={cols as any}
            data={filtered}
            keyExtractor={(r) => r.id}
            onRowClick={openView}
            emptyMessage="No employees"
            pageSize={25}
            loading={!ready}
          />
        )}
      </ContentCard>

      <Modal
        isOpen={open}
        onClose={closeForm}
        title={modalTitle}
        description={modalDesc}
        icon={modalIcon}
        size="lg"
        footer={
          sel && mode === "view" ? (
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="secondary"
                onClick={closeForm}
                className="flex-1 sm:flex-none"
              >
                Close
              </Button>
              <Button variant="primary" onClick={() => openEdit(sel)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            </div>
          ) : mode === "edit" || mode === "create" ? (
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="secondary"
                onClick={closeForm}
                className="flex-1 sm:flex-none"
                disabled={saving || creating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                className="flex-1 sm:flex-none shadow-sm"
                disabled={saving || creating}
                loading={mode === "create" ? creating : saving}
              >
                {mode === "create" ? "Add Employee" : "Save changes"}
              </Button>
            </div>
          ) : null
        }
      >
        {sel && mode === "view" && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
              <div className="w-12 h-12 rounded-xl bg-printflow-primary-fixed flex items-center justify-center font-bold text-printflow-primary text-sm shrink-0">
                {((sel.fname[0] ?? "") + (sel.lname[0] ?? ""))
                  .toUpperCase()
                  .slice(0, 2) || "-"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-printflow-on-surface leading-tight truncate">
                  {fullName(sel)}
                </p>
                <p className="text-[13px] text-printflow-on-surface-variant truncate flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {sel.contact_number}
                </p>
                <p className="text-xs text-printflow-on-surface-variant/80">
                  {sel.role}
                </p>
              </div>
              <StatusBadge status={sel.status} className="shrink-0" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>EMPLOYEE ID</p>
                <p className="font-mono text-xs text-printflow-on-surface mt-1">
                  {sel.employee_id || "-"}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>ROLE</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {sel.role}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>AGE</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {formatAge(sel.age)}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>BIRTHDATE</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {sel.birthdate
                    ? new Date(sel.birthdate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "-"}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>GENDER</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {sel.gender}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 sm:col-span-2">
                <p className={labelCls}>CONTACT</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {sel.contact_number}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>DATE CREATED</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {formatDateCreated(sel.created_at)}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
                <p className={labelCls}>LAST UPDATED</p>
                <p className="text-sm font-medium text-printflow-on-surface mt-1">
                  {formatDateCreated(sel.updated_at)}
                </p>
              </div>
              <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40 sm:col-span-2">
                <p className={labelCls}>ADDRESS</p>
                {sel.address?.region ? (
                  <>
                    <p className="text-sm font-medium text-printflow-on-surface mt-1 leading-snug">
                      {[
                        sel.address.barangay,
                        sel.address.city,
                        sel.address.province,
                        sel.address.zip,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="text-xs text-printflow-on-surface-variant/70 mt-0.5">
                      {sel.address.region}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-printflow-on-surface-variant/60 mt-1">
                    -
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {(mode === "edit" || mode === "create") && (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {formError && (
              <div
                role="alert"
                className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm flex items-start gap-2"
              >
                <span className="font-semibold shrink-0">
                  Couldn&apos;t save:
                </span>
                <span className="flex-1">{formError}</span>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="shrink-0 text-printflow-error/70 hover:text-printflow-error"
                  aria-label="Dismiss error"
                >
                  x
                </button>
              </div>
            )}

            {mode === "create" ? (
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3 flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  SIGN-IN ACCOUNT
                </p>
                <p className="text-[12px] text-printflow-on-surface-variant/80 mb-3 leading-relaxed">
                  This creates a Firebase Auth sign-in account for the
                  employee. Share the password with them out-of-band.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Email</label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                      <input
                        type="email"
                        value={emailVal}
                        onChange={(e) => setEmailVal(e.target.value)}
                        placeholder="juan.delacruz@printflow.app"
                        autoComplete="off"
                        className={inputBase}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                      <input
                        type={showPw ? "text" : "password"}
                        value={passwordVal}
                        onChange={(e) => setPasswordVal(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className={`${inputBase} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-printflow-on-surface-variant hover:text-printflow-on-surface"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirm password</label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPasswordVal}
                        onChange={(e) =>
                          setConfirmPasswordVal(e.target.value)
                        }
                        placeholder="Repeat the password"
                        autoComplete="new-password"
                        className={`${inputBase} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-printflow-on-surface-variant hover:text-printflow-on-surface"
                        aria-label={
                          showConfirmPw ? "Hide password" : "Show password"
                        }
                      >
                        {showConfirmPw ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {confirmPasswordVal && passwordVal && confirmPasswordVal !== passwordVal && (
                      <p className="text-[11px] text-printflow-error mt-1.5">
                        Passwords don&apos;t match
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-printflow-surface-container/40 border border-printflow-outline-variant/40 text-[12px] text-printflow-on-surface-variant leading-relaxed">
                Sign-in email and password are set when the account is
                created. Manage them in the Firebase Console.
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
                EMPLOYEE DETAILS
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>First name</label>
                  <div className="relative mt-1.5">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                    <input
                      value={fname}
                      onChange={(e) => setFname(e.target.value)}
                      placeholder="Juan"
                      className={inputBase}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Middle initial</label>
                  <div className="relative mt-1.5">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                    <input
                      value={initial}
                      onChange={(e) => setInitial(e.target.value)}
                      placeholder="A."
                      maxLength={3}
                      className={inputBase}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <div className="relative mt-1.5">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                    <input
                      value={lname}
                      onChange={(e) => setLname(e.target.value)}
                      placeholder="Dela Cruz"
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
                CONTACT &amp; DEMOGRAPHICS
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Contact number</label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                    <input
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="0917 123 4567"
                      inputMode="tel"
                      className={inputBase}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Birthdate</label>
                  <div className="relative mt-1.5">
                    <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                    <input
                      type="date"
                      value={birthdateVal}
                      onChange={(e) => setBirthdateVal(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className={`${inputBase} pr-10`}
                    />
                  </div>
                  {/* Live preview of the derived age so the user can see
                      the result of their pick without submitting. */}
                  <p className="text-[11px] text-printflow-on-surface-variant mt-1.5">
                    Age:{" "}
                    <span className="font-medium text-printflow-on-surface">
                      {birthdateVal
                        ? formatAge(ageFromBirthdate(birthdateVal))
                        : "-"}
                    </span>
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <div className="relative mt-1.5">
                    <select
                      value={genderVal}
                      onChange={(e) =>
                        setGenderVal(e.target.value as EmployeeGender)
                      }
                      className={`${inputBase} pl-10 pr-10 appearance-none`}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">
                        Prefer not to say
                      </option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
                ROLE &amp; STATUS
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Role</label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-printflow-on-surface-variant pointer-events-none">
                      {roleVal === "Admin" ? (
                        <Shield className="w-4 h-4" />
                      ) : roleVal === "POS_Cashier" ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <UserIcon className="w-4 h-4" />
                      )}
                    </span>
                    <select
                      value={roleVal}
                      onChange={(e) =>
                        setRoleVal(e.target.value as EmployeeRole)
                      }
                      className={`${inputBase} pl-10 pr-10 appearance-none`}
                    >
                      <option value="Admin">Admin</option>
                      <option value="POS_Cashier">POS_Cashier</option>
                      <option value="Production Staff">
                        Production Staff
                      </option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-printflow-on-surface-variant mt-1.5 flex items-center gap-1">
                    {roleVal === "Admin" && (
                      <>
                        <Shield className="w-3 h-3" /> Full access to dashboard
                        &amp; settings
                      </>
                    )}
                    {roleVal === "POS_Cashier" && (
                      <>
                        <UserCheck className="w-3 h-3" /> POS orders &amp;
                        payments only
                      </>
                    )}
                    {roleVal === "Production Staff" && (
                      <>
                        <UserIcon className="w-3 h-3" /> Production queue only
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative mt-1.5">
                    <div
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                        statusVal === "active"
                          ? "bg-printflow-success"
                          : "bg-printflow-outline-variant"
                      }`}
                    />
                    <select
                      value={statusVal}
                      onChange={(e) =>
                        setStatusVal(
                          e.target.value as "active" | "inactive",
                        )
                      }
                      className={`${inputBase} pl-8 pr-10 appearance-none`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                ADDRESS
              </p>
              <AddressCascade value={addrVal} onChange={setAddrVal} />
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={kpiModal !== null}
        onClose={() => setKpiModal(null)}
        title={kpiModal ? kpiMeta[kpiModal].title : ""}
        description={kpiModal ? kpiMeta[kpiModal].desc : undefined}
        icon={kpiModal ? kpiMeta[kpiModal].icon : undefined}
        size="lg"
        footer={
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="secondary"
              onClick={() => setKpiModal(null)}
              className="flex-1 sm:flex-none"
            >
              Close
            </Button>
          </div>
        }
      >
        {kpiFilteredEmployees.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={<Inbox className="w-7 h-7" />}
              title="No employees in this group"
              description="No records match this role filter."
            />
          </div>
        ) : (
          <DataTable
            columns={employeeKpiColumns as any}
            data={kpiFilteredEmployees}
            keyExtractor={(e) => e.id}
            emptyMessage="No employees in this group"
            onRowClick={(e) => {
              setKpiModal(null);
              openView(e);
            }}
            pageSize={10}
          />
        )}
      </Modal>

      {/* Archive / unarchive / (de)activate confirm (sweetalert-style). */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
        title={
          confirmAction
            ? {
                archive: `Archive ${fullName(confirmAction.emp)}?`,
                unarchive: `Restore ${fullName(confirmAction.emp)}?`,
                deactivate: `Deactivate ${fullName(confirmAction.emp)}?`,
                activate: `Reactivate ${fullName(confirmAction.emp)}?`,
              }[confirmAction.kind]
            : ""
        }
        description={
          confirmAction
            ? {
                archive:
                  "Leaves the roster for the Archived tab and blocks sign-in on web and mobile.",
                unarchive:
                  "Returns to the roster and re-enables sign-in.",
                deactivate:
                  "Blocks sign-in on web and mobile until reactivated.",
                activate: "Re-enables sign-in on web and mobile.",
              }[confirmAction.kind]
            : undefined
        }
        icon={
          confirmAction?.kind === "archive" ? (
            <Archive className="w-5 h-5" />
          ) : confirmAction?.kind === "unarchive" ? (
            <ArchiveRestore className="w-5 h-5" />
          ) : (
            <Power className="w-5 h-5" />
          )
        }
        size="sm"
        footer={
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="secondary"
              onClick={() => setConfirmAction(null)}
              className="flex-1 sm:flex-none"
              disabled={confirmBusy}
            >
              Cancel
            </Button>
            <Button
              variant={
                confirmAction?.kind === "activate" ||
                confirmAction?.kind === "unarchive"
                  ? "primary"
                  : "danger"
              }
              onClick={() => void runConfirmAction()}
              className="flex-1 sm:flex-none"
              loading={confirmBusy}
              disabled={confirmBusy}
            >
              {confirmAction
                ? {
                    archive: "Archive",
                    unarchive: "Restore",
                    deactivate: "Deactivate",
                    activate: "Reactivate",
                  }[confirmAction.kind]
                : "Confirm"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-printflow-on-surface-variant">
          {confirmAction?.kind === "archive" &&
            "The HR record moves to Archived and the linked sign-in account is set inactive."}
          {confirmAction?.kind === "unarchive" &&
            "The HR record returns to the roster and the linked sign-in account is set active."}
          {(confirmAction?.kind === "deactivate" ||
            confirmAction?.kind === "activate") &&
            "The linked sign-in account is updated to match."}
        </p>
      </Modal>

      {/* Permanent delete (Archived tab only): explicit confirm + the
          signed-in admin's own password. Removes the HR doc and the
          linked sign-in profile; the Firebase Auth account itself must
          be removed in the Firebase Console. */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteTarget(null);
            setDeletePassword("");
            setDeleteError(null);
          }
        }}
        title={
          deleteTarget
            ? `Delete ${fullName(deleteTarget)} forever?`
            : "Delete employee?"
        }
        description="This cannot be undone. The HR record and sign-in profile are removed."
        icon={<Trash2 className="w-5 h-5" />}
        size="sm"
        footer={
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setDeletePassword("");
                setDeleteError(null);
              }}
              className="flex-1 sm:flex-none"
              disabled={deleteBusy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void runDelete()}
              className="flex-1 sm:flex-none"
              loading={deleteBusy}
              disabled={deleteBusy}
            >
              Delete forever
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-sm text-printflow-error">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              {deleteTarget
                ? `${fullName(deleteTarget)} (${deleteTarget.employee_id}) will be permanently removed, including their sign-in profile.`
                : ""}
              Afterwards, also delete their Auth account in the Firebase
              Console (Authentication - Users) - the app cannot remove
              other users&apos; Auth accounts.
            </p>
          </div>
          {deleteError && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
            >
              {deleteError}
            </div>
          )}
          <div>
            <label className={labelCls}>Your password (confirm it&apos;s you)</label>
            <div className="relative">
              <input
                type={showDeletePw ? "text" : "password"}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                placeholder="********"
                className="w-full px-3 py-2 pr-10 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary"
              />
              <button
                type="button"
                onClick={() => setShowDeletePw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-printflow-on-surface-variant hover:text-printflow-on-surface"
                aria-label={showDeletePw ? "Hide password" : "Show password"}
              >
                {showDeletePw ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Re-sign-in admin modal - fires after a successful Create.
          Firebase's createUserWithEmailAndPassword swaps the SDK
          session, so the admin has to re-authenticate before the
          app trusts them again. The modal is intentionally hard to
          dismiss: cancel signs the admin out entirely (so they're
          not silently signed in as the new account). */}
      <Modal
        isOpen={createdAccount !== null}
        onClose={() => {
          if (reauthing) return;
          void handleCancelReauth();
        }}
        title="Confirm it's you"
        description={
          createdAccount
            ? `Account created for ${createdAccount.name}. Re-enter your password to sign back in as the admin.`
            : undefined
        }
        icon={<Shield className="w-5 h-5" />}
        size="md"
        footer={
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="secondary"
              onClick={() => void handleCancelReauth()}
              className="flex-1 sm:flex-none"
              disabled={reauthing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleConfirmReauth()}
              className="flex-1 sm:flex-none shadow-sm"
              disabled={reauthing || !adminPassword}
              loading={reauthing}
            >
              Confirm &amp; re-sign in
            </Button>
          </div>
        }
      >
        {createdAccount && currentAdmin && (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl bg-printflow-primary-fixed/15 border border-printflow-primary/30 text-[13px] text-printflow-on-surface leading-relaxed">
              <p>
                You&apos;re currently signed in as{" "}
                <span className="font-semibold">
                  {createdAccount.email}
                </span>{" "}
                (the new account). Re-authenticate as{" "}
                <span className="font-semibold">
                  {currentAdmin.email}
                </span>{" "}
                to continue managing employees.
              </p>
            </div>

            <div>
              <label className={labelCls}>Your admin email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                <input
                  value={currentAdmin.email ?? ""}
                  readOnly
                  className={`${inputBase} opacity-80 cursor-not-allowed`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Your admin password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
                <input
                  type={showPw ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !reauthing && adminPassword) {
                      e.preventDefault();
                      void handleConfirmReauth();
                    }
                  }}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className={`${inputBase} pr-10`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-printflow-on-surface-variant hover:text-printflow-on-surface"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
              {reauthError && (
                <p className="text-[12px] text-printflow-error mt-1.5">
                  {reauthError}
                </p>
              )}
              <p className="text-[11px] text-printflow-on-surface-variant/80 mt-2 leading-relaxed">
                Cancel will sign you out entirely so you&apos;re not
                silently signed in as the new employee.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
