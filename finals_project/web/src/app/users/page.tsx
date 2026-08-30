"use client";

import { useState } from "react";
import { Plus, Shield, User, UserCheck, Eye, EyeOff, Mail, Lock, ChevronDown, Pencil, UserPlus } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import { ContentCard, FilterToolbar, DataTable, StatusBadge, Button, Modal, KpiCard } from "@/components/ui";
import { mockUsers } from "@/lib/mockData";
import { User as UserType } from "@/types";

export default function UsersPage() {
 const [active, setActive] = useState("All");
 const [search, setSearch] = useState("");
 const [sel, setSel] = useState<UserType | null>(null);
 const [open, setOpen] = useState(false);
 const [mode, setMode] = useState<"view"|"edit"|"create">("view");
 const [showPw, setShowPw] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);
 const [roleVal, setRoleVal] = useState<UserType["role"]>("POS_Cashier");

 const tabs = [
  { id: "All", label: "All", count: mockUsers.length },
  { id: "Admin", label: "Admin", count: mockUsers.filter(u=>u.role==="Admin").length },
  { id: "POS_Cashier", label: "POS/Cashier", count: mockUsers.filter(u=>u.role==="POS_Cashier").length },
  { id: "Production Staff", label: "Production Staff", count: mockUsers.filter(u=>u.role==="Production Staff").length },
 ];

 const filtered = active==="All" ? mockUsers : mockUsers.filter(u=>u.role===active);

 const cols = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "role", header: "Role (Firebase Auth)", render: (r:UserType)=><span className="px-2.5 py-0.5 rounded-full text-xs bg-printflow-primary-fixed/20 text-printflow-primary">{r.role}</span> },
  { key: "status", header: "Status", render: (r:UserType)=><StatusBadge status={r.status} /> },
  { key: "lastLogin", header: "Last Login" },
  { key: "actions", header: "", className: "w-10", render: ()=><Eye className="w-4 h-4 text-printflow-on-surface-variant" /> },
 ];

 const inputBase = "w-full pl-10 pr-4 py-2.5 text-sm bg-printflow-surface-container rounded-xl border border-printflow-outline-variant/40 focus:bg-printflow-surface focus:border-printflow-primary focus:ring-4 focus:ring-printflow-primary/10 focus:outline-none transition-all placeholder:text-printflow-on-surface-variant/50";
 const labelCls = "text-[12px] font-medium tracking-wide text-printflow-on-surface-variant";

 const openCreate = () => { setSel(null); setMode("create"); setRoleVal("POS_Cashier"); setShowPw(false); setShowConfirm(false); setOpen(true); };
 const openView = (r: UserType) => { setSel(r); setRoleVal(r.role); setMode("view"); setOpen(true); };

 const modalIcon = mode==="create" ? <UserPlus className="w-5 h-5" /> : mode==="edit" ? <Pencil className="w-5 h-5" /> : sel ? <User className="w-5 h-5" /> : <User className="w-5 h-5" />;
 const modalTitle = mode==="create" ? "Add User" : mode==="edit" ? `Edit ${sel?.name}` : sel ? sel.name : "User";
  const modalDesc = mode==="create"
   ? "Create a team account, 3 roles only (Admin, POS/Cashier, Production Staff)"
   : mode==="edit" ? "Update account details and access"
   : sel ? `${sel.role} • ${sel.email}` : undefined;

 return (
  <AdminLayout title="Users" subtitle="Manage team accounts" onSearch={setSearch}>
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <KpiCard label="Total Users" value={mockUsers.length} icon="User" />
    <KpiCard label="Admin" value={mockUsers.filter(u=>u.role==="Admin").length} icon="Shield" />
    <KpiCard label="POS/Cashier" value={mockUsers.filter(u=>u.role==="POS_Cashier").length} icon="UserCheck" />
    <KpiCard label="Production Staff" value={mockUsers.filter(u=>u.role==="Production Staff").length} icon="User" />
   </div>

   <ContentCard title="Team Members" subtitle={`${filtered.length} accounts`}>
    <FilterToolbar tabs={tabs} activeTab={active} onTabChange={setActive} searchPlaceholder="Search name or email" onSearchChange={setSearch} searchValue={search} customActions={<Button variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Add User</Button>} />
    <DataTable columns={cols} data={filtered.filter(u=> !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))} keyExtractor={r=>r.id} onRowClick={openView} emptyMessage="No users" />
   </ContentCard>

   <Modal
    isOpen={open}
    onClose={()=>{setOpen(false); setSel(null);}}
    title={modalTitle}
    description={modalDesc}
    icon={modalIcon}
    size="lg"
    footer={
     sel && mode==="view" ? (
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button variant="secondary" onClick={()=>setOpen(false)} className="flex-1 sm:flex-none">Close</Button>
       <Button variant="primary" onClick={()=>setMode("edit")}><Pencil className="w-4 h-4" />Edit</Button>
      </div>
     ) : (mode==="edit"||mode==="create") ? (
      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
       <Button variant="secondary" onClick={()=>setOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
       <Button variant="primary" className="flex-1 sm:flex-none shadow-sm">{mode==="create" ? <><Plus className="w-4 h-4" />Create</> : "Save changes"}</Button>
      </div>
     ) : null
    }
   >
    {sel && mode==="view" && (
     <div className="space-y-5">
      <div className="flex items-center gap-4 p-4 bg-printflow-surface-container/50 rounded-xl border border-printflow-outline-variant/40">
       <div className="w-12 h-12 rounded-xl bg-printflow-primary-fixed flex items-center justify-center font-bold text-printflow-primary text-sm shrink-0">{sel.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
       <div className="min-w-0 flex-1">
        <p className="font-semibold text-printflow-on-surface leading-tight truncate">{sel.name}</p>
        <p className="text-[13px] text-printflow-on-surface-variant truncate">{sel.email}</p>
        <p className="text-xs text-printflow-on-surface-variant/80">{sel.role}</p>
       </div>
       <StatusBadge status={sel.status} className="shrink-0" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>ROLE</p><p className="text-sm font-medium text-printflow-on-surface mt-1">{sel.role}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>STATUS</p><div className="mt-1.5"><StatusBadge status={sel.status} /></div>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>LAST LOGIN</p><p className="text-sm font-medium text-printflow-on-surface mt-1">{sel.lastLogin}</p>
       </div>
       <div className="p-3.5 bg-printflow-surface rounded-xl border border-printflow-outline-variant/40">
        <p className={labelCls}>USER ID</p><p className="font-mono text-xs text-printflow-on-surface mt-1 truncate">{sel.id}</p>
       </div>
      </div>
     </div>
    )}

    {(mode==="edit"||mode==="create") && (
     <form className="space-y-6" onSubmit={(e)=>e.preventDefault()}>
      {/* Group: Account Details */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">ACCOUNT DETAILS</p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelCls}>Name</label>
         <div className="relative mt-1.5">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input defaultValue={sel?.name||""} placeholder="Juan Dela Cruz" className={inputBase} />
         </div>
        </div>
        <div>
         <label className={labelCls}>Email</label>
         <div className="relative mt-1.5">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
          <input defaultValue={sel?.email||""} placeholder="juan@brialyns.com" className={inputBase} />
         </div>
        </div>
       </div>
      </div>

      {/* Group: Access */}
      <div>
       <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">ACCESS</p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
         <label className={labelCls}>Role 3 only</label>
         <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-printflow-on-surface-variant pointer-events-none">
           {roleVal==="Admin" ? <Shield className="w-4 h-4" /> : roleVal==="POS_Cashier" ? <UserCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </span>
          <select
           value={roleVal}
           onChange={(e)=>setRoleVal(e.target.value as UserType["role"])}
           className={`${inputBase} pl-10 pr-10 appearance-none`}
          >
           <option value="Admin">Admin</option>
           <option value="POS_Cashier">POS_Cashier</option>
           <option value="Production Staff">Production Staff</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
         </div>
         <p className="text-[11px] text-printflow-on-surface-variant mt-1.5 flex items-center gap-1">
          {roleVal==="Admin" && <><Shield className="w-3 h-3" /> Full access to dashboard & settings</>}
          {roleVal==="POS_Cashier" && <><UserCheck className="w-3 h-3" /> POS orders & payments only</>}
          {roleVal==="Production Staff" && <><User className="w-3 h-3" /> Production queue only</>}
         </p>
        </div>
        <div>
         <label className={labelCls}>Status</label>
         <div className="relative mt-1.5">
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${sel?.status==="active" || (!sel && roleVal) ? "bg-printflow-success" : "bg-printflow-outline-variant"}`} />
          <select defaultValue={sel?.status||"active"} className={`${inputBase} pl-8 pr-10 appearance-none`}>
           <option value="active">Active</option>
           <option value="inactive">Inactive</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
         </div>
        </div>
       </div>
      </div>

      {/* Group: Security */}
      {mode==="create" && (
       <div>
        <p className="text-[11px] font-semibold tracking-widest text-printflow-on-surface-variant mb-3">SECURITY</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div>
          <label className={labelCls}>Password</label>
          <div className="relative mt-1.5">
           <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-printflow-on-surface-variant pointer-events-none" />
           <input type={showPw ? "text" : "password"} placeholder="••••••••" className={`${inputBase} pr-10`} />
           <button type="button" onClick={()=>setShowPw(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-printflow-surface-container-high flex items-center justify-center text-printflow-on-surface-variant transition-colors">
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
           <button type="button" onClick={()=>setShowConfirm(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-printflow-surface-container-high flex items-center justify-center text-printflow-on-surface-variant transition-colors">
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
           </button>
          </div>
         </div>
        </div>
       </div>
      )}
     </form>
    )}
   </Modal>
  </AdminLayout>
 );
}
