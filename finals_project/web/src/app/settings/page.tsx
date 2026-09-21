"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Palette,
  Shield,
  Sun,
  Moon,
  Monitor,
  User as UserIcon,
  Phone,
  Cake,
  MapPin,
  IdCard,
  Eye,
  EyeOff,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, Button, EmptyState, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { subscribeEmployees } from "@/lib/services/employees";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import type { Employee, UserAddress } from "@/types";

const settingsSections = [
  { id: "general", label: "General", icon: <UserIcon className="w-5 h-5" /> },
  { id: "appearance", label: "Appearance", icon: <Palette className="w-5 h-5" /> },
  { id: "security", label: "Security", icon: <Shield className="w-5 h-5" /> },
];

const STORAGE_KEY = "printflow.settings";

type StoredSettings = {
  theme: "light" | "dark" | "system";
};

const DEFAULTS: StoredSettings = {
  theme: "light",
};

function formatSettingsDate(v: unknown): string {
  if (!v) return "";
  const d =
    v instanceof Date
      ? v
      : typeof v === "string"
        ? new Date(v)
        : typeof v === "object" && v && "toDate" in v
          ? (v as { toDate: () => Date }).toDate()
          : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(a?: UserAddress): string {
  if (!a) return "";
  return [a.barangay, a.city, a.province, a.region, a.zip]
    .filter((p) => p && p.trim() !== "")
    .join(", ");
}

function fullName(e: Employee): string {
  return [e.fname, e.initial, e.lname].filter(Boolean).join(" ");
}

function readStoredTheme(): StoredSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("printfow.settings");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      if (
        parsed.theme === "light" ||
        parsed.theme === "dark" ||
        parsed.theme === "system"
      ) {
        return { theme: parsed.theme };
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [s, setS] = useState<StoredSettings>(readStoredTheme);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const toast = useToast();
  const { user: currentUser, firebaseUser } = useAuth();
  const adminUser = currentUser;
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  const pwToggleBtn =
    "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-printflow-on-surface-variant hover:text-printflow-on-surface";

  // Real password change via Firebase Auth. Re-authentication is required
  // by Firebase before updatePassword - wrong current password surfaces
  // as an error instead of a fake success toast.
  const handlePasswordChange = async () => {
    if (!firebaseUser?.email) {
      toast.error("You are not signed in");
      return;
    }
    if (pwNew.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("New passwords do not match");
      return;
    }
    setPwSaving(true);
    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, pwCurrent);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, pwNew);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      toast.success("Password updated");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Password update failed",
      );
    } finally {
      setPwSaving(false);
    }
  };

  // Persist + sync theme (initial state already holds the stored value
  // via lazy init, so the mount write-back is a harmless no-op).
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (s.theme === "dark") root.classList.add("dark");
      else if (s.theme === "light") root.classList.remove("dark");
      else {
        const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", prefers);
      }
      // Share the resolved value with the header bootstrap + toggle:
      // "system" is resolved here at write time so "printflow-theme"
      // only ever holds "dark" | "light" (both treat anything else as
      // light). An explicit "System" choice still follows the OS.
      const resolved =
        s.theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : s.theme;
      try {
        window.localStorage.setItem("printflow-theme", resolved);
      } catch {
        /* ignore */
      }
    }
  }, [s]);

  // Employee roster (links the signed-in account to its HR record so the
  // Profile card mirrors the Add Employee form fields).
  useEffect(() => {
    const unsub = subscribeEmployees(setEmployees);
    return () => unsub();
  }, []);

  // HR record for the signed-in user: stored uid first, then email match
  // (covers accounts created before the link fields existed).
  const myEmployee = useMemo(() => {
    if (!adminUser) return null;
    if (adminUser.uid) {
      const byUid = employees.find((e) => e.uid === adminUser.uid);
      if (byUid) return byUid;
    }
    const email = (adminUser.email ?? "").trim().toLowerCase();
    if (!email) return null;
    return (
      employees.find((e) => (e.email ?? "").trim().toLowerCase() === email) ??
      null
    );
  }, [employees, adminUser]);

  const update = <K extends keyof StoredSettings>(k: K, v: StoredSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const inputCls =
    "w-full px-4 py-2.5 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:border-transparent";
  const labelCls =
    "block text-sm font-medium text-printflow-on-surface-variant mb-1";

  const initials = (myEmployee ? fullName(myEmployee) : (adminUser?.name ?? ""))
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2) || "U";
  const addressText = myEmployee ? formatAddress(myEmployee.address) : "";

  return (
    <AdminLayout title="Settings" subtitle="Configure your Brialyns Art Sign workspace preferences">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Settings Sidebar */}
        <aside className="w-full lg:w-56 flex-shrink-0">
          <nav
            className="bg-printflow-surface rounded-xl border border-printflow-outline-variant p-4"
            aria-label="Settings navigation"
          >
            <ul className="space-y-1" role="list">
              {settingsSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                      activeSection === section.id
                        ? "bg-printflow-primary text-printflow-on-primary"
                        : "text-printflow-on-surface-variant hover:bg-printflow-surface-container hover:text-printflow-on-surface"
                    }`}
                    aria-current={activeSection === section.id ? "page" : undefined}
                  >
                    {section.icon}
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Settings Content (space-y gaps the stacked section cards) */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* General Settings */}
          {activeSection === "general" && (
            <ContentCard
              title="Profile"
              subtitle="Your account - mirrors your employee record"
            >
              <div className="flex items-center gap-4 p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
                <div className="w-14 h-14 rounded-xl bg-printflow-primary-fixed flex items-center justify-center font-bold text-printflow-primary text-lg shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-printflow-on-surface leading-tight truncate">
                    {myEmployee ? fullName(myEmployee) : (adminUser?.name ?? "Unknown")}
                  </p>
                  <p className="text-[13px] text-printflow-on-surface-variant truncate">
                    {myEmployee?.email ?? adminUser?.email}
                  </p>
                  <p className="text-xs text-printflow-on-surface-variant/80 mt-0.5">
                    {adminUser?.role}
                    {myEmployee ? ` - ${myEmployee.employee_id}` : ""}
                    {adminUser?.lastLogin
                      ? ` - Last login ${formatSettingsDate(adminUser.lastLogin)}`
                      : ""}
                  </p>
                </div>
              </div>

              {myEmployee ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Phone className="w-4 h-4 text-printflow-on-surface-variant shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-printflow-on-surface-variant">Contact number</p>
                      <p className="font-medium text-printflow-on-surface truncate">
                        {myEmployee.contact_number || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Cake className="w-4 h-4 text-printflow-on-surface-variant shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-printflow-on-surface-variant">Birthdate</p>
                      <p className="font-medium text-printflow-on-surface truncate">
                        {myEmployee.birthdate || "-"}
                        {myEmployee.age > 0 ? ` (age ${myEmployee.age})` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserIcon className="w-4 h-4 text-printflow-on-surface-variant shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-printflow-on-surface-variant">Gender</p>
                      <p className="font-medium text-printflow-on-surface truncate">
                        {myEmployee.gender || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IdCard className="w-4 h-4 text-printflow-on-surface-variant shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-printflow-on-surface-variant">Status</p>
                      <p className="font-medium text-printflow-on-surface truncate capitalize">
                        {myEmployee.status}
                        {myEmployee.archived ? " (archived)" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 min-w-0 md:col-span-2">
                    <MapPin className="w-4 h-4 text-printflow-on-surface-variant shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-printflow-on-surface-variant">Address</p>
                      <p className="font-medium text-printflow-on-surface">
                        {addressText || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    icon={<UserIcon className="w-6 h-6" />}
                    title="No employee record linked"
                    description="Your sign-in account has no matching HR record. Ask an Owner to link one from the Employees page."
                  />
                </div>
              )}
            </ContentCard>
          )}

          {/* Appearance Settings */}
          {activeSection === "appearance" && (
            <ContentCard
              title="Theme"
              subtitle="Customize the look and feel of Brialyns Art Sign"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(
                  [
                    { id: "light", label: "Light", desc: "Clean, bright interface", icon: <Sun className="w-10 h-10 mx-auto mb-3 text-printflow-primary" /> },
                    { id: "dark", label: "Dark", desc: "Easy on the eyes", icon: <Moon className="w-10 h-10 mx-auto mb-3 text-printflow-primary" /> },
                    { id: "system", label: "System", desc: "Match OS preference", icon: <Monitor className="w-10 h-10 mx-auto mb-3 text-printflow-primary" /> },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => update("theme", opt.id)}
                    className={`p-6 rounded-xl border-2 transition-all text-center ${
                      s.theme === opt.id
                        ? "border-printflow-primary bg-printflow-primary-fixed/10"
                        : "border-printflow-outline-variant hover:border-printflow-primary/50"
                    }`}
                    aria-pressed={s.theme === opt.id}
                  >
                    {opt.icon}
                    <h4 className="font-semibold text-printflow-on-surface mb-1">
                      {opt.label}
                    </h4>
                    <p className="text-sm text-printflow-on-surface-variant">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </ContentCard>
          )}

          {/* Security Settings */}
          {activeSection === "security" && (
            <ContentCard
              title="Change Password"
              subtitle="Update your account password"
            >
              <div className="space-y-4 max-w-md">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <div className="relative">
                    <input
                      type={showPwCurrent ? "text" : "password"}
                      className={`${inputCls} pr-10`}
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwCurrent((v) => !v)}
                      className={pwToggleBtn}
                      aria-label={showPwCurrent ? "Hide password" : "Show password"}
                    >
                      {showPwCurrent ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>New Password</label>
                  <div className="relative">
                    <input
                      type={showPwNew ? "text" : "password"}
                      className={`${inputCls} pr-10`}
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew((v) => !v)}
                      className={pwToggleBtn}
                      aria-label={showPwNew ? "Hide password" : "Show password"}
                    >
                      {showPwNew ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPwConfirm ? "text" : "password"}
                      className={`${inputCls} pr-10`}
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwConfirm((v) => !v)}
                      className={pwToggleBtn}
                      aria-label={showPwConfirm ? "Hide password" : "Show password"}
                    >
                      {showPwConfirm ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={handlePasswordChange}
                    disabled={pwSaving}
                  >
                    {pwSaving ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </div>
            </ContentCard>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
