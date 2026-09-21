"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ScrollText, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/layout";
import {
  ContentCard,
  DataTable,
  Button,
  EmptyState,
  FeedErrorBanner,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useFeedStatus } from "@/lib/useFeedStatus";
import { csvRow, downloadCsv } from "@/lib/csv";
import {
  subscribeAuditLogs,
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  formatAuditValue,
} from "@/lib/services/audit";
import type { AuditAction, AuditLogEntry, AuditModule } from "@/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function entryDay(e: AuditLogEntry): string {
  return (e.created_at ?? "").slice(0, 10);
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_IDS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];
const MODULE_IDS = Object.keys(AUDIT_MODULE_LABELS) as AuditModule[];

export default function AuditPage() {
  const { user, loading } = useAuth();
  const isOwner = user?.role === "Owner";
  const toast = useToast();
  const { feedError, onFeedError, feedNonce, retryFeed } = useFeedStatus();

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [activeModule, setActiveModule] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [fromDate, setFromDate] = useState(monthAgoIso);
  const [toDate, setToDate] = useState(todayIso);
  const [userQuery, setUserQuery] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    const unsub = subscribeAuditLogs(setRows, 500, onFeedError);
    return () => unsub();
  }, [isOwner, feedNonce, onFeedError]);

  const moduleTabs = useMemo(
    () => [
      { id: "All", label: "All", count: rows.length },
      ...MODULE_IDS.map((m) => ({
        id: m,
        label: AUDIT_MODULE_LABELS[m],
        count: rows.filter((r) => r.module === m).length,
      })),
    ],
    [rows],
  );

  const filtered = useMemo(() => {
    const uq = userQuery.trim().toLowerCase();
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeModule !== "All" && r.module !== activeModule) return false;
      if (actionFilter !== "All" && r.action !== actionFilter) return false;
      const day = entryDay(r);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      if (
        uq &&
        !`${r.actor_name} ${r.actor_email}`.toLowerCase().includes(uq)
      ) {
        return false;
      }
      if (
        q &&
        !`${r.record_label} ${r.record_id}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, activeModule, actionFilter, fromDate, toDate, userQuery, search]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No audit entries match - nothing to export yet.");
      return;
    }
    const headers = [
      "timestamp",
      "actor_name",
      "actor_email",
      "actor_role",
      "action",
      "module",
      "record",
      "old_value",
      "new_value",
      "source",
      "ip",
    ];
    const lines = [
      headers.join(","),
      ...filtered.map((r) =>
        csvRow([
          r.created_at ?? "",
          r.actor_name,
          r.actor_email,
          r.actor_role,
          AUDIT_ACTION_LABELS[r.action] ?? r.action,
          AUDIT_MODULE_LABELS[r.module] ?? r.module,
          `${r.record_label} (${r.record_id})`,
          formatAuditValue(r.old_value),
          formatAuditValue(r.new_value),
          r.source,
          r.ip ?? "",
        ]),
      ),
    ];
    downloadCsv(`audit-log-${todayIso()}.csv`, lines);
    toast.success(`Exported ${filtered.length} audit entries`);
  };

  const cols = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (r: AuditLogEntry) => (
        <span className="text-xs whitespace-nowrap">
          {formatTimestamp(r.created_at)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "User",
      render: (r: AuditLogEntry) => (
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">
            {r.actor_name || r.actor_email}
          </span>
          <span className="text-[11px] text-printflow-on-surface-variant truncate">
            {r.actor_email} - {r.actor_role}
          </span>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (r: AuditLogEntry) => (
        <span className="text-xs font-semibold">
          {AUDIT_ACTION_LABELS[r.action] ?? r.action}
        </span>
      ),
    },
    {
      key: "record",
      header: "Record",
      render: (r: AuditLogEntry) => (
        <span className="text-xs font-mono break-all">{r.record_label}</span>
      ),
    },
    {
      key: "change",
      header: "Old - New",
      render: (r: AuditLogEntry) => (
        <span className="text-xs break-all">
          {formatAuditValue(r.old_value)}
          <span className="text-printflow-on-surface-variant"> - </span>
          {formatAuditValue(r.new_value)}
        </span>
      ),
    },
    { key: "source", header: "Source" },
    {
      key: "ip",
      header: "IP",
      render: (r: AuditLogEntry) => (
        <span className="text-xs font-mono">{r.ip ?? "-"}</span>
      ),
    },
  ];

  if (!loading && !isOwner) {
    return (
      <AdminLayout
        title="Audit Log"
        subtitle="Immutable system activity trail"
      >
        <ContentCard className="text-center py-16">
          <EmptyState
            icon={<ShieldAlert className="w-8 h-8" />}
            title="Owner only"
            description="The audit trail is visible to the Owner role only. Your account does not have access."
          />
        </ContentCard>
      </AdminLayout>
    );
  }

  const selectCls =
    "px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary";
  const inputCls =
    "px-3 py-2 text-sm bg-printflow-surface-container rounded-lg border border-printflow-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-printflow-primary";

  return (
    <AdminLayout
      title="Audit Log"
      subtitle="Immutable system activity trail (append-only)"
      onSearch={setSearch}
      headerActions={
        <Button variant="secondary" onClick={handleExport}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      }
    >
      {feedError && (
        <FeedErrorBanner
          message={feedError}
          showCached={rows.length > 0}
          onRetry={retryFeed}
        />
      )}
      <ContentCard
        title="Activity"
        subtitle={`${filtered.length} of ${rows.length} entries`}
        className="mb-6"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs text-printflow-on-surface-variant mb-1">
                Search record or ID
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search record or ID"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs text-printflow-on-surface-variant mb-1">
                Module
              </label>
              <select
                value={activeModule}
                onChange={(e) => setActiveModule(e.target.value)}
                className={selectCls}
              >
                {moduleTabs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id === "All"
                      ? `All modules (${t.count})`
                      : `${t.label} (${t.count})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-printflow-on-surface-variant mb-1">
                Action type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className={selectCls}
              >
                <option value="All">All actions</option>
                {ACTION_IDS.map((a) => (
                  <option key={a} value={a}>
                    {AUDIT_ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-printflow-on-surface-variant mb-1">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-printflow-on-surface-variant mb-1">
                To
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs text-printflow-on-surface-variant mb-1">
                User (name or email)
              </label>
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="e.g. cashier01@..."
                className={`${inputCls} w-full`}
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-printflow-on-surface-variant pb-2">
              <ScrollText className="w-3.5 h-3.5" />
              Append-only - entries cannot be edited or deleted.
            </p>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <DataTable
              columns={cols}
              data={filtered}
              keyExtractor={(r) => r.id ?? `${r.created_at}-${r.record_id}-${r.action}`}
              emptyMessage="No audit entries match these filters"
              pageSize={25}
            />
          </div>
        </div>
      </ContentCard>
    </AdminLayout>
  );
}
