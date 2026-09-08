"use client";

/**
 * /users — VIEW-ONLY directory of Firebase Auth sign-in accounts.
 *
 * Edit/create flow was removed when the Add/Edit employee form was
 * consolidated onto /employees (the source of truth for HR records).
 * Sign-in accounts here are read-only: admins can browse, filter,
 * and inspect existing users, but cannot add new accounts or change
 * a user's role/status from this page. New sign-in accounts are
 * created via the "Add Employee" form on /employees — both the
 * HR record and the Firebase Auth account are written from a single
 * submission. The /users page only displays the resulting accounts.
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
 FilterToolbar,
 DataTable,
 StatusBadge,
 Button,
 Modal,
 KpiCard,
 EmptyState,
} from "@/components/ui";
import { subscribeUsers } from "@/lib/services/users";
import {
 useSparkSeries,
 userLastLoginKey,
} from "@/lib/hooks/useSparkSeries";
import type { User as UserType } from "@/types";

function formatLastLogin(iso: string | undefined): string {
 if (!iso) return "—";
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

export default function UsersPage() {
 const [users, setUsers] = useState<UserType[]>([]);
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<UserType | null>(null);
 const [open, setOpen] = useState(false);
 const [kpiModal, setKpiModal] = useState<
  null | "all" | "Admin" | "POS_Cashier" | "Production Staff"
 >(null);

 useEffect(() => {
  const unsub = subscribeUsers(setUsers);
  return () => unsub();
 }, []);

 // /users is the user-management page — the signed-in admin (Owner or
 // Admin) needs to see every account so they can browse them. The
 // previous "owner-only sees self" filter was hiding newly-created
 // users from the bootstrap Owner and made the page look broken
 // right after a successful Create. The page is now view-only.
 const visibleUsers = useMemo(() => users, [users]);

 // Live sparkline series — last-login counts per day for the last 7 days.
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
  ],
  [visibleUsers],
 );

 const filtered = useMemo(() => {
  const byRole = active === "All" ? visibleUsers : visibleUsers.filter((u) => u.role === active);
  if (!search) return byRole;
  const q = search.toLowerCase();
  return byRole.filter(
   (u) =>
    u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  );
 }, [visibleUsers, active, search]);

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
  setOpen(true);
 };
 const closeView = () => {
  setOpen(false);
  setSel(null);
 };

 return (
  <AdminLayout title="Users" subtitle="Team sign-in accounts" onSearch={setSearch}>
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <KpiCard
     label="Total Users"
     value={visibleUsers.length}
     icon="User"
     sparkline={allUsersSeries}
     sparklineTone="primary"
     lastUpdated="Live"
     onClick={() => setKpiModal("all")}
    />
    <KpiCard
     label="Admin"
     value={visibleUsers.filter((u) => u.role === "Admin").length}
     icon="Shield"
     sparkline={adminSeries}
     sparklineTone="primary"
     lastUpdated="Live"
     onClick={() => setKpiModal("Admin")}
    />
    <KpiCard
     label="POS/Cashier"
     value={visibleUsers.filter((u) => u.role === "POS_Cashier").length}
     icon="UserCheck"
     sparkline={cashierSeries}
     sparklineTone="success"
     lastUpdated="Live"
     onClick={() => setKpiModal("POS_Cashier")}
    />
    <KpiCard
     label="Production Staff"
     value={visibleUsers.filter((u) => u.role === "Production Staff").length}
     icon="User"
     sparkline={productionSeries}
     sparklineTone="warning"
     lastUpdated="Live"
     onClick={() => setKpiModal("Production Staff")}
    />
   </div>

   <ContentCard title="Team Members" subtitle={`${filtered.length} accounts`}>
    <FilterToolbar
     tabs={tabs}
     activeTab={active}
     onTabChange={setActive}
     searchPlaceholder="Search name or email"
     onSearchChange={setSearch}
     searchValue={search}
    />
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
     />
    )}
   </ContentCard>

   {/* View modal — read-only. Same fields as before, no Edit button. */}
   <Modal
    isOpen={open}
    onClose={closeView}
    title={sel?.name ?? "User"}
    description={sel ? `${sel.role} • ${sel.email}` : undefined}
    icon={<UserIcon className="w-5 h-5" />}
    size="lg"
    footer={
     <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
      <Button
       variant="secondary"
       onClick={closeView}
       className="flex-1 sm:flex-none"
      >
       Close
      </Button>
     </div>
    }
   >
    {sel && (
     <div className="space-y-5">
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
        <p className={labelCls}>ROLE</p>
        <p className="text-sm font-medium text-printflow-on-surface mt-1">
         {sel.role}
        </p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>STATUS</p>
        <div className="mt-1.5">
         <StatusBadge status={sel.status} />
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
         <p className="text-sm text-printflow-on-surface-variant/60 mt-1">—</p>
        )}
        {sel.address?.region && (
         <p className="text-xs text-printflow-on-surface-variant/70 mt-0.5">
          {sel.address.region}
         </p>
        )}
       </div>
      </div>
      {/* Read-only hint: directs admins to the right surface to make
          changes. The /users page intentionally has no edit affordance. */}
      <p className="text-[12px] text-printflow-on-surface-variant/80 leading-relaxed">
       To add or edit an employee&apos;s HR record, go to{" "}
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
     />
    )}
   </Modal>
  </AdminLayout>
 );
}
