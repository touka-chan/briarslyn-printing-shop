"use client";

/**
 * /users - directory of Firebase Auth sign-in accounts + approval desk.
 *
 * Browsing is read-only, but Owners/Admins can approve access here:
 * auto-provisioned accounts arrive `inactive` (pending), and the view
 * modal lets an admin set the role (Cashier / Production / Admin /
 * Owner) and flip Active <-> Inactive. HR records still live on
 * /employees; this page governs sign-in access only.
 */

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
 Shield,
 User as UserIcon,
 UserCheck,
 Eye,
 Inbox,
} from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  DataTable,
  StatusBadge,
  Button,
  Modal,
  KpiCard,
  EmptyState,
  FeedErrorBanner,
} from "@/components/ui";
import { subscribeUsers, updateUser } from "@/lib/services/users";
import { useFeedStatus } from "@/lib/useFeedStatus";
import { useToast } from "@/components/ui/Toast";
import {
 useSparkSeries,
 userLastLoginKey,
} from "@/lib/hooks/useSparkSeries";
import type { User as UserType } from "@/types";

function formatLastLogin(iso: string | undefined): string {
 if (!iso) return "-";
 const d = new Date(iso);
 return d.toLocaleDateString("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
 });
}

function getLastLogin(u: any): string {
 return u.lastLogin ?? u.last_login_at ?? "";
}

const APPROVABLE_ROLES: UserType["role"][] = [
  "POS_Cashier",
  "Production Staff",
  "Admin",
  "Owner",
];

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserType[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<UserType | null>(null);
  const [open, setOpen] = useState(false);
  // Approval editor state (synced from `sel` on open).
  const [editRole, setEditRole] = useState<UserType["role"]>("POS_Cashier");
  const [editStatus, setEditStatus] = useState<UserType["status"]>("inactive");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
 const [kpiModal, setKpiModal] = useState<
  null | "all" | "Admin" | "POS_Cashier" | "Production Staff"
 >(null);

  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  useEffect(() => {
   const unsub = subscribeUsers(
     (rows) => {
       setUsers(rows);
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

  // /users is the user-management page - the signed-in admin (Owner or
  // Admin) needs to see every account so they can browse them. The
  // previous "owner-only sees self" filter was hiding newly-created
  // users from the bootstrap Owner and made the page look broken
  // right after a successful Create. The page is now view-only.
  //
  // Deactivated/archived staff disappear from the default view: only
  // ACTIVE accounts list here (they also cannot sign in). Inactive
  // accounts live under their own tab so nothing is hidden forever.
  const activeUsers = useMemo(
   () => users.filter((u) => u.status === "active"),
   [users],
  );
  const inactiveUsers = useMemo(
   () => users.filter((u) => u.status !== "active"),
   [users],
  );
  const visibleUsers = activeUsers;

 // Live sparkline series - last-login counts per day for the last 7 days.
 const allUsersSeries = useSparkSeries(visibleUsers, userLastLoginKey, 7);
 const adminSeries = useSparkSeries(
  visibleUsers.filter((u) => u.role === "Admin"),
  userLastLoginKey,
  7,
 );
 const cashierSeries = useSparkSeries(
  visibleUsers.filter((u) => u.role === "POS_Cashier"),
  userLastLoginKey,
  7,
 );
 const productionSeries = useSparkSeries(
  visibleUsers.filter((u) => u.role === "Production Staff"),
  userLastLoginKey,
  7,
 );

 const tabs = useMemo(
  () => [
   { id: "All", label: "All", count: visibleUsers.length },
   {
    id: "Owner",
    label: "Owner",
    count: visibleUsers.filter((u) => u.role === "Owner").length,
   },
   {
    id: "Admin",
    label: "Admin",
    count: visibleUsers.filter((u) => u.role === "Admin").length,
   },
   {
    id: "POS_Cashier",
    label: "POS/Cashier",
    count: visibleUsers.filter((u) => u.role === "POS_Cashier").length,
   },
    {
     id: "Production Staff",
     label: "Production Staff",
     count: visibleUsers.filter((u) => u.role === "Production Staff").length,
    },
    {
     id: "Inactive",
     label: "Inactive",
     count: inactiveUsers.length,
    },
   ],
   [visibleUsers, inactiveUsers],
  );

  const filtered = useMemo(() => {
   const pool = active === "Inactive" ? inactiveUsers : visibleUsers;
   const byRole =
    active === "All" || active === "Inactive"
     ? pool
     : pool.filter((u) => u.role === active);
   if (!search) return byRole;
  const q = search.toLowerCase();
  return byRole.filter(
   (u) =>
    u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  );
  }, [visibleUsers, inactiveUsers, active, search]);

 const cols = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  {
   key: "role",
   header: "Role (Firebase Auth)",
   render: (r: UserType) => (
    <span className="px-2.5 py-0.5 rounded-full text-xs bg-printflow-primary-fixed/20 text-printflow-primary">
     {r.role}
    </span>
   ),
  },
  {
   key: "status",
   header: "Status",
   render: (r: UserType) => <StatusBadge status={r.status} />,
  },
  {
   key: "lastLogin",
   header: "Last Login",
   render: (r: any) => formatLastLogin(getLastLogin(r)),
  },
  {
   key: "actions",
   header: "",
   className: "w-10",
   render: () => <Eye className="w-4 h-4 text-printflow-on-surface-variant" />,
  },
 ];

 const labelCls = "text-[12px] font-medium tracking-wide text-printflow-on-surface-variant";

 const kpiFilteredUsers = useMemo(() => {
  if (kpiModal === null) return [] as UserType[];
  if (kpiModal === "all") return visibleUsers;
  return visibleUsers.filter((u) => u.role === kpiModal);
 }, [kpiModal, visibleUsers]);

 const kpiMeta: Record<
  NonNullable<typeof kpiModal>,
  { title: string; desc: string; icon: ReactNode; count: number }
 > = {
  all: {
   title: "All Users",
   desc: `${kpiFilteredUsers.length} accounts across all roles`,
   icon: <UserIcon className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  Admin: {
   title: "Admin Users",
   desc: `${kpiFilteredUsers.length} accounts with admin access`,
   icon: <Shield className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  POS_Cashier: {
   title: "POS / Cashier Users",
   desc: `${kpiFilteredUsers.length} accounts on the front-of-house team`,
   icon: <UserCheck className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  "Production Staff": {
   title: "Production Staff Users",
   desc: `${kpiFilteredUsers.length} accounts on the production floor`,
   icon: <UserIcon className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
 };

 const userKpiColumns: {
  key: keyof UserType | "actions";
  header: string;
  className?: string;
  render?: (r: UserType) => ReactNode;
 }[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
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
   key: "lastLogin",
   header: "Last Login",
   render: (r: any) => formatLastLogin(getLastLogin(r)),
  },
  {
   key: "actions",
   header: "",
   className: "w-10",
   render: () => <Eye className="w-4 h-4 text-printflow-on-surface-variant" />,
  },
 ];

  const openView = (r: UserType) => {
   setSel(r);
   setEditRole(r.role);
   setEditStatus(r.status);
   setSaveError(null);
   setOpen(true);
  };
  const closeView = () => {
   if (saving) return;
   setOpen(false);
   setSel(null);
  };

  const accessDirty =
   !!sel && (editRole !== sel.role || editStatus !== sel.status);

  const handleSaveAccess = async () => {
   if (!sel || !accessDirty || saving) return;
   setSaving(true);
   setSaveError(null);
   try {
    await updateUser(sel.id, { role: editRole, status: editStatus });
    toast.success(
     editStatus === "active"
      ? `${sel.name || sel.email} activated as ${editRole}`
      : `${sel.name || sel.email} set to inactive`,
    );
    closeView();
   } catch (e: unknown) {
    setSaveError(
     e instanceof Error ? e.message : "Failed to update access.",
    );
   } finally {
    setSaving(false);
   }
  };

 return (
   <AdminLayout title="Users" subtitle="Team sign-in accounts" onSearch={setSearch}>
    {feedError && (
     <FeedErrorBanner
      message={feedError}
      showCached={users.length > 0}
      onRetry={retryFeed}
     />
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <KpiCard
     label="Total Users"
     value={visibleUsers.length}
     icon="User"
     sparkline={allUsersSeries}
     sparklineTone="primary"
     lastUpdated="Live"
     onClick={() => setKpiModal("all")}
     loading={!ready}
    />
    <KpiCard
     label="Admin"
     value={visibleUsers.filter((u) => u.role === "Admin").length}
     icon="Shield"
     sparkline={adminSeries}
     sparklineTone="primary"
     lastUpdated="Live"
     onClick={() => setKpiModal("Admin")}
     loading={!ready}
    />
    <KpiCard
     label="POS/Cashier"
     value={visibleUsers.filter((u) => u.role === "POS_Cashier").length}
     icon="UserCheck"
     sparkline={cashierSeries}
     sparklineTone="success"
     lastUpdated="Live"
     onClick={() => setKpiModal("POS_Cashier")}
     loading={!ready}
    />
    <KpiCard
     label="Production Staff"
     value={visibleUsers.filter((u) => u.role === "Production Staff").length}
     icon="User"
     sparkline={productionSeries}
     sparklineTone="warning"
     lastUpdated="Live"
     onClick={() => setKpiModal("Production Staff")}
     loading={!ready}
    />
   </div>

   <ContentCard title="Team Members" subtitle={`${filtered.length} accounts`}>
    <div className="flex flex-wrap items-end gap-3 mb-4">
     <div className="min-w-[200px] flex-1">
      <label className="block text-xs text-printflow-on-surface-variant mb-1">
       Search
      </label>
      <input
       type="text"
       value={search}
       onChange={(e) => setSearch(e.target.value)}
       placeholder="Search name or email"
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
    </div>
    {filtered.length === 0 ? (
     <div className="py-12">
      <EmptyState
       icon={<Inbox className="w-7 h-7" />}
       title="No users"
       description="No accounts match this filter."
      />
     </div>
    ) : (
      <DataTable
       columns={cols}
       data={filtered}
       keyExtractor={(r) => r.id}
       onRowClick={openView}
       emptyMessage="No users"
       pageSize={25}
       loading={!ready}
      />
    )}
   </ContentCard>

    {/* View + approval modal. Browsing is read-only; Owners/Admins
        can set role + active state here (pending approvals included). */}
    <Modal
     isOpen={open}
     onClose={closeView}
     title={sel?.name ?? "User"}
     description={sel ? `${sel.role} - ${sel.email}` : undefined}
     icon={<UserIcon className="w-5 h-5" />}
     size="lg"
     footer={
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button
        variant="secondary"
        onClick={closeView}
        disabled={saving}
        className="flex-1 sm:flex-none"
       >
        Close
       </Button>
       <Button
        variant="primary"
        onClick={() => void handleSaveAccess()}
        disabled={!accessDirty || saving}
        loading={saving}
        className="flex-1 sm:flex-none"
       >
        {saving ? "Saving..." : "Save access"}
       </Button>
      </div>
     }
    >
     {sel && (
      <div className="space-y-5">
       {sel.status !== "active" && (
        <div
         role="status"
         className="px-4 py-3 rounded-xl bg-printflow-warning-container/40 border border-printflow-warning-container/60 text-sm text-printflow-warning"
        >
         Pending approval - this account can&apos;t sign in until you
         set a role and flip it to Active below.
        </div>
       )}
       {saveError && (
        <div
         role="alert"
         className="px-4 py-3 rounded-xl bg-printflow-error/10 border border-printflow-error/30 text-printflow-error text-sm"
        >
         {saveError}
        </div>
       )}
       <div className="flex items-center gap-4 p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
       <div className="w-12 h-12 rounded-xl bg-printflow-primary-fixed flex items-center justify-center font-bold text-printflow-primary text-sm shrink-0">
        {sel.name
         .split(" ")
         .map((n) => n[0])
         .join("")
         .slice(0, 2)}
       </div>
       <div className="min-w-0 flex-1">
        <p className="font-semibold text-printflow-on-surface leading-tight truncate">
         {sel.name}
        </p>
        <p className="text-[13px] text-printflow-on-surface-variant truncate">
         {sel.email}
        </p>
        <p className="text-xs text-printflow-on-surface-variant/80">
         {sel.role}
        </p>
       </div>
       <StatusBadge status={sel.status} className="shrink-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>EMAIL</p>
        <p className="text-sm font-medium text-printflow-on-surface mt-1 truncate">
         {sel.email}
        </p>
       </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <label className={labelCls} htmlFor="users-role">
          ROLE
         </label>
         <select
          id="users-role"
          value={editRole}
          onChange={(e) =>
           setEditRole(e.target.value as UserType["role"])
          }
          className="mt-1.5 w-full px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary"
         >
          {APPROVABLE_ROLES.map((r) => (
           <option key={r} value={r}>
            {r}
           </option>
          ))}
         </select>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <span className={labelCls}>STATUS</span>
         <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge status={editStatus} />
          <button
           type="button"
           role="switch"
           aria-checked={editStatus === "active"}
           aria-label="Toggle active state"
           onClick={() =>
            setEditStatus(editStatus === "active" ? "inactive" : "active")
           }
           className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-printflow-primary ${
            editStatus === "active"
             ? "bg-printflow-success"
             : "bg-printflow-outline-variant"
           }`}
          >
           <span
            aria-hidden
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-printflow-surface shadow transition-all ${
             editStatus === "active" ? "left-[22px]" : "left-0.5"
            }`}
           />
          </button>
          <span className="text-xs text-printflow-on-surface-variant">
           {editStatus === "active" ? "Active" : "Inactive"}
          </span>
         </div>
        </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>LAST LOGIN</p>
        <p className="text-sm font-medium text-printflow-on-surface mt-1">
         {formatLastLogin(getLastLogin(sel))}
        </p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>USER ID</p>
        <p className="font-mono text-xs text-printflow-on-surface mt-1 truncate">
         {sel.id}
        </p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>ADDRESS</p>
        {sel.address?.region ? (
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
        ) : (
         <p className="text-sm text-printflow-on-surface-variant/60 mt-1">-</p>
        )}
        {sel.address?.region && (
         <p className="text-xs text-printflow-on-surface-variant/70 mt-0.5">
          {sel.address.region}
         </p>
        )}
       </div>
      </div>
       {/* Access editing lives here (role + active state); HR records
           stay on /employees. */}
       <p className="text-[12px] text-printflow-on-surface-variant/80 leading-relaxed">
        Role and access are managed here - approve pending accounts by
        setting a role and flipping them Active. For HR records, go to{" "}
        <span className="font-medium text-printflow-on-surface">Employees</span>.
        Sign-in accounts are created from the Add Employee form there.
       </p>
     </div>
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
    {kpiFilteredUsers.length === 0 ? (
     <div className="py-8">
      <EmptyState
       icon={<Inbox className="w-7 h-7" />}
       title="No users in this group"
       description="No accounts match this role filter."
      />
     </div>
    ) : (
      <DataTable
       columns={userKpiColumns as any}
       data={kpiFilteredUsers}
       keyExtractor={(u) => u.id}
       emptyMessage="No users in this group"
       onRowClick={(u) => {
        setKpiModal(null);
        openView(u);
       }}
       pageSize={10}
      />
    )}
   </Modal>
  </AdminLayout>
 );
}
