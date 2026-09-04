"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Plus, Shield, User, UserCheck, Eye, EyeOff, Mail, Lock, ChevronDown, UserPlus } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, DataTable, StatusBadge, Button, Modal, KpiCard, useToast } from "@/components/ui";
import { mockUsers, mockSales, mockOrders, mockProductionAll, sparklineData, kpiUpdatedLabel } from "@/lib/mockData";
import { User as UserType, UserAddress } from "@/types";
import { AddressCascade } from "@/components/forms";

// Excludes the Owner — the Employees page is the team view.
const employees: UserType[] = mockUsers.filter((u) => u.role !== "Owner");

// PHP formatter (mirrors sales/page.tsx so per-cashier revenue lines up with the
// Sales page's Peso formatting).
const formatPHP = (n: number) =>
 `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

// Per-employee performance metrics. Cashiers get revenue from sales
// (revenue is realized at sale time, when cash is taken). Production Staff
// get revenue from completed production jobs they've been assigned to
// (revenue is realized at completion). Admin has no honest per-user
// transactional metric, so it returns null and renders as "—".
type Metrics = { txns: number; revenue: number; avg: number };
const computeMetrics = (u: UserType): Metrics | null => {
 if (u.role === "Admin" || u.role === "Owner") return null;
 if (u.role === "POS_Cashier") {
  const sales = mockSales.filter((s) => s.cashierId === u.id);
  const txns = sales.length;
  const revenue = sales.reduce((sum, s) => sum + s.order.payment_amount, 0);
  const avg = txns > 0 ? Math.round(revenue / txns) : 0;
  return { txns, revenue, avg };
 }
 // Production Staff: revenue from completed jobs assigned to this user.
 const completedJobs = mockProductionAll.filter(
  (j) => j.assignedTo === u.id && j.status === "Completed",
 );
 const orderById = new Map(mockOrders.map((o) => [o.order_id, o]));
 const txns = completedJobs.length;
 const revenue = completedJobs.reduce((sum, j) => {
  const order = orderById.get(j.order_id);
  return sum + (order?.payment_amount ?? 0);
 }, 0);
 const avg = txns > 0 ? Math.round(revenue / txns) : 0;
 return { txns, revenue, avg };
};

export default function EmployeesPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<UserType | null>(null);
 const [open, setOpen] = useState(false);
 const [showPw, setShowPw] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);
 const [roleVal, setRoleVal] = useState<UserType["role"]>("POS_Cashier");
 const [addrVal, setAddrVal] = useState<UserAddress>({});
 const [kpiModal, setKpiModal] = useState<
  null | "all" | "Admin" | "POS_Cashier" | "Production Staff" | "active"
 >(null);
 const toast = useToast();

 const handleSubmit = () => {
  const where = addrVal?.city ? ` in ${addrVal.city}` : "";
  toast.success(`Invitation sent to new ${roleVal} account${where}`);
  setOpen(false);
  setSel(null);
  setAddrVal({});
 };

 const tabs = [
  { id: "All", label: "All", count: employees.length },
  { id: "Admin", label: "Admin", count: employees.filter((u) => u.role === "Admin").length },
  { id: "POS_Cashier", label: "POS/Cashier", count: employees.filter((u) => u.role === "POS_Cashier").length },
  { id: "Production Staff", label: "Production Staff", count: employees.filter((u) => u.role === "Production Staff").length },
 ];

 const filtered = active === "All" ? employees : employees.filter((u) => u.role === active);
 const searched = filtered.filter(
  (u) => !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
 );

 const adminCount = employees.filter((u) => u.role === "Admin").length;
 const cashierCount = employees.filter((u) => u.role === "POS_Cashier").length;
 const prodCount = employees.filter((u) => u.role === "Production Staff").length;
 const activeCount = employees.filter((u) => u.status === "active").length;

 const inputBase =
  "w-full pl-10 pr-4 py-2.5 text-sm bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/40 focus:bg-printflow-surface focus:border-printflow-primary focus:ring-4 focus:ring-printflow-primary/10 focus:outline-none transition-all placeholder:text-printflow-on-surface-variant/50";
 const labelCls = "text-[12px] font-medium tracking-wide text-printflow-on-surface-variant";

 // --- KPI drill-down ----------------------------------------------------
 // Click a role / status card → modal opens with the employees that
 // contribute to that count. Clicking a row deep-links into the view modal.
 const kpiFilteredUsers = useMemo(() => {
  if (kpiModal === null) return [] as UserType[];
  if (kpiModal === "all") return employees;
  if (kpiModal === "active") return employees.filter((u) => u.status === "active");
  return employees.filter((u) => u.role === kpiModal);
 }, [kpiModal]);

 const kpiMeta: Record<
  NonNullable<typeof kpiModal>,
  { title: string; desc: string; icon: ReactNode; count: number }
 > = {
  all: {
   title: "All Employees",
   desc: `${kpiFilteredUsers.length} accounts across all roles`,
   icon: <UserCheck className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  Admin: {
   title: "Admin Employees",
   desc: `${kpiFilteredUsers.length} accounts with admin access`,
   icon: <Shield className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  POS_Cashier: {
   title: "Cashier Employees",
   desc: `${kpiFilteredUsers.length} accounts on the front-of-house team`,
   icon: <UserCheck className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  "Production Staff": {
   title: "Production Staff Employees",
   desc: `${kpiFilteredUsers.length} accounts on the production floor`,
   icon: <User className="w-5 h-5" />,
   count: kpiFilteredUsers.length,
  },
  active: {
   title: "Active Today",
   desc: `${kpiFilteredUsers.length} active employee accounts`,
   icon: <UserCheck className="w-5 h-5" />,
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
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "lastLogin", header: "Last Login" },
  {
   key: "actions",
   header: "",
   className: "w-10",
   render: () => <Eye className="w-4 h-4 text-printflow-on-surface-variant" />,
  },
 ];

 const openCreate = () => {
  setSel(null);
  setRoleVal("POS_Cashier");
  setAddrVal({});
  setShowPw(false);
  setShowConfirm(false);
  setOpen(true);
 };
 const openView = (r: UserType) => {
  setSel(r);
  setRoleVal(r.role);
  setAddrVal(r.address ?? {});
  setOpen(true);
 };

 const selMetrics = sel ? computeMetrics(sel) : null;
 const modalIcon = <UserCheck className="w-5 h-5" />;
 const modalTitle = sel ? sel.name : "Add Employee";
 const modalDesc = sel
  ? `${sel.role} • ${sel.email}`
  : "Create a team account (Admin, POS/Cashier, or Production Staff)";

 return (
  <AdminLayout title="Employees" subtitle="Manage team accounts (excludes Owner)" onSearch={setSearch}>
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
    <KpiCard
     label="Total Employees"
     value={employees.length}
     icon="UserCheck"
     sparkline={sparklineData(employees.length, "rising", "employees-total")}
     sparklineTone="primary"
     lastUpdated={kpiUpdatedLabel("employees-total")}
     onClick={() => setKpiModal("all")}
    />
    <KpiCard
     label="Admin"
     value={adminCount}
     icon="Shield"
     sparkline={sparklineData(adminCount, "stable", "employees-admin")}
     sparklineTone="primary"
     lastUpdated={kpiUpdatedLabel("employees-admin")}
     onClick={() => setKpiModal("Admin")}
    />
    <KpiCard
     label="Cashiers"
     value={cashierCount}
     icon="UserCheck"
     sparkline={sparklineData(cashierCount, "rising", "employees-cashiers")}
     sparklineTone="success"
     lastUpdated={kpiUpdatedLabel("employees-cashiers")}
     onClick={() => setKpiModal("POS_Cashier")}
    />
    <KpiCard
     label="Production Staff"
     value={prodCount}
     icon="User"
     sparkline={sparklineData(prodCount, "wave", "employees-prod")}
     sparklineTone="warning"
     lastUpdated={kpiUpdatedLabel("employees-prod")}
     onClick={() => setKpiModal("Production Staff")}
    />
    <KpiCard
     label="Active Today"
     value={activeCount}
     icon="UserCheck"
     sparkline={sparklineData(activeCount, "stable", "employees-active")}
     sparklineTone="success"
     lastUpdated={kpiUpdatedLabel("employees-active")}
     onClick={() => setKpiModal("active")}
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
     customActions={
      <Button variant="primary" onClick={openCreate}>
       <Plus className="w-4 h-4" />
       Add Employee
      </Button>
     }
    />
    <DataTable
     columns={[
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      {
       key: "role",
       header: "Role",
       render: (r: UserType) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs bg-printflow-primary-fixed/20 text-printflow-primary">
         {r.role}
        </span>
       ),
      },
      { key: "status", header: "Status", render: (r: UserType) => <StatusBadge status={r.status} /> },
      { key: "lastLogin", header: "Last Login" },
      {
       key: "txns",
       header: "Transactions",
       className: "text-right",
       render: (r: UserType) => {
        const m = computeMetrics(r);
        return m ? <span className="font-mono text-xs">{m.txns}</span> : <span className="text-printflow-on-surface-variant/50">—</span>;
       },
      },
      {
       key: "revenue",
       header: "Revenue",
       className: "text-right",
       render: (r: UserType) => {
        const m = computeMetrics(r);
        return m ? <span className="font-medium">{formatPHP(m.revenue)}</span> : <span className="text-printflow-on-surface-variant/50">—</span>;
       },
      },
      {
       key: "avg",
       header: "Avg",
       className: "text-right",
       render: (r: UserType) => {
        const m = computeMetrics(r);
        return m ? <span className="font-mono text-xs">{formatPHP(m.avg)}</span> : <span className="text-printflow-on-surface-variant/50">—</span>;
       },
      },
      {
       key: "actions",
       header: "",
       className: "w-10",
       render: () => <Eye className="w-4 h-4 text-printflow-on-surface-variant" />,
      },
     ]}
     data={searched}
     keyExtractor={(r) => r.id}
     onRowClick={openView}
     emptyMessage="No employees"
    />
   </ContentCard>

   {/* View / Add Employee modal — read-only when viewing, create form when adding */}
   <Modal
    isOpen={open}
    onClose={() => {
     setOpen(false);
     setSel(null);
     setAddrVal({});
    }}
    title={modalTitle}
    description={modalDesc}
    icon={modalIcon}
    size="lg"
    footer={
     sel ? (
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
        Close
       </Button>
      </div>
     ) : (
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
        Cancel
       </Button>
       <Button variant="primary" onClick={handleSubmit} className="flex-1 sm:flex-none shadow-sm">
        <Plus className="w-4 h-4" />
        Create
       </Button>
      </div>
     )
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
        <p className="font-semibold text-printflow-on-surface leading-tight truncate">{sel.name}</p>
        <p className="text-[13px] text-printflow-on-surface-variant truncate">{sel.email}</p>
        <p className="text-xs text-printflow-on-surface-variant/80">{sel.role}</p>
       </div>
       <StatusBadge status={sel.status} className="shrink-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>EMAIL</p>
        <p className="text-sm font-medium text-printflow-on-surface mt-1 truncate">{sel.email}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>ROLE</p>
        <p className="text-sm font-medium text-printflow-on-surface mt-1">{sel.role}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>STATUS</p>
        <div className="mt-1.5">
         <StatusBadge status={sel.status} />
        </div>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>LAST LOGIN</p>
        <p className="text-sm font-medium text-printflow-on-surface mt-1">{sel.lastLogin}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>USER ID</p>
        <p className="font-mono text-xs text-printflow-on-surface mt-1 truncate">{sel.id}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>ADDRESS</p>
        {sel.address?.region ? (
         <p className="text-sm font-medium text-printflow-on-surface mt-1 leading-snug">
          {[sel.address.barangay, sel.address.city, sel.address.province, sel.address.zip]
           .filter(Boolean)
           .join(", ")}
         </p>
        ) : (
         <p className="text-sm text-printflow-on-surface-variant/60 mt-1">—</p>
        )}
        {sel.address?.region && (
         <p className="text-xs text-printflow-on-surface-variant/70 mt-0.5">{sel.address.region}</p>
        )}
       </div>
      </div>

      {/* Performance metrics — for cashiers this is "sales" (revenue at sale
          time); for production staff this is "completed jobs" (revenue at
          job completion). Admin shows "—" because there is no honest
          per-admin transactional metric. */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        PERFORMANCE METRICS
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className={labelCls}>{sel?.role === "Production Staff" ? "JOBS COMPLETED" : "TRANSACTIONS"}</p>
         <p className="text-lg font-semibold text-printflow-on-surface mt-1">
          {selMetrics ? <span className="font-mono">{selMetrics.txns}</span> : "—"}
         </p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className={labelCls}>REVENUE</p>
         <p className="text-lg font-semibold text-printflow-on-surface mt-1">
          {selMetrics ? formatPHP(selMetrics.revenue) : "—"}
         </p>
        </div>
        <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
         <p className={labelCls}>AVG</p>
         <p className="text-lg font-semibold text-printflow-on-surface mt-1">
          {selMetrics ? <span className="font-mono">{formatPHP(selMetrics.avg)}</span> : "—"}
         </p>
        </div>
       </div>
       {selMetrics && selMetrics.txns === 0 && (
        <p className="text-[11px] text-printflow-on-surface-variant mt-2">
         {sel?.role === "Production Staff"
          ? "No completed jobs yet."
          : "No completed sales yet."}
        </p>
       )}
      </div>
     </div>
    )}

    {!sel && (
     <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* Group: Account Details */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        ACCOUNT DETAILS
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelCls}>Name</label>
         <div className="relative mt-1.5">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input placeholder="Juan Dela Cruz" className={inputBase} />
         </div>
        </div>
        <div>
         <label className={labelCls}>Email</label>
         <div className="relative mt-1.5">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input placeholder="juan@brialyns.com" className={inputBase} />
         </div>
        </div>
       </div>
      </div>

      {/* Group: Access — no Owner option per "Employees" page scope. */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        ACCESS
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
            <User className="w-4 h-4" />
           )}
          </span>
          <select
           value={roleVal}
           onChange={(e) => setRoleVal(e.target.value as UserType["role"])}
           className={`${inputBase} pl-10 pr-10 appearance-none`}
          >
           <option value="Admin">Admin</option>
           <option value="POS_Cashier">POS_Cashier</option>
           <option value="Production Staff">Production Staff</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
         </div>
         <p className="text-[11px] text-printflow-on-surface-variant mt-1.5 flex items-center gap-1">
          {roleVal === "Admin" && (
           <>
            <Shield className="w-3 h-3" /> Full access to dashboard & settings
           </>
          )}
          {roleVal === "POS_Cashier" && (
           <>
            <UserCheck className="w-3 h-3" /> POS orders & payments only
           </>
          )}
          {roleVal === "Production Staff" && (
           <>
            <User className="w-3 h-3" /> Production queue only
           </>
          )}
         </p>
        </div>
        <div>
         <label className={labelCls}>Status</label>
         <div className="relative mt-1.5">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-printflow-success" />
          <select defaultValue="active" className={`${inputBase} pl-8 pr-10 appearance-none`}>
           <option value="active">Active</option>
           <option value="inactive">Inactive</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
         </div>
        </div>
       </div>
      </div>

      {/* Group: Address — PSGC cascade dropdown */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        ADDRESS
       </p>
       <AddressCascade value={addrVal} onChange={setAddrVal} />
      </div>

      {/* Group: Security */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">
        SECURITY
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelCls}>Password</label>
         <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input type={showPw ? "text" : "password"} placeholder="••••••••" className={`${inputBase} pr-10`} />
          <button
           type="button"
           onClick={() => setShowPw((v) => !v)}
           className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-printflow-surface-container-high flex items-center justify-center text-printflow-on-surface-variant transition-colors"
          >
           {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
         </div>
         <p className="text-[11px] text-printflow-on-surface-variant mt-1.5">Min 8 characters</p>
        </div>
        <div>
         <label className={labelCls}>Confirm Password</label>
         <div className="relative mt-1.5">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input type={showConfirm ? "text" : "password"} placeholder="••••••••" className={`${inputBase} pr-10`} />
          <button
           type="button"
           onClick={() => setShowConfirm((v) => !v)}
           className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-printflow-surface-container-high flex items-center justify-center text-printflow-on-surface-variant transition-colors"
          >
           {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
         </div>
        </div>
       </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-printflow-on-surface-variant">
       <UserPlus className="w-3.5 h-3.5" />
       Owner accounts are not added from this page.
      </div>
     </form>
    )}
   </Modal>

   {/* KPI drill-down: filtered employee list for the clicked role / status card */}
   <Modal
    isOpen={kpiModal !== null}
    onClose={() => setKpiModal(null)}
    title={kpiModal ? kpiMeta[kpiModal].title : ""}
    description={kpiModal ? kpiMeta[kpiModal].desc : undefined}
    icon={kpiModal ? kpiMeta[kpiModal].icon : undefined}
    size="lg"
    footer={
     <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
      <Button variant="secondary" onClick={() => setKpiModal(null)} className="flex-1 sm:flex-none">
       Close
      </Button>
     </div>
    }
   >
    <DataTable
     columns={userKpiColumns as any}
     data={kpiFilteredUsers}
     keyExtractor={(u) => u.id}
     emptyMessage="No employees in this group"
     onRowClick={(u) => {
      setKpiModal(null);
      openView(u);
     }}
    />
   </Modal>
  </AdminLayout>
 );
}
