"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { WORKER_BASE_URL } from "@/lib/worker";

/** Inline pieces: **bold**, *italic*, `code`. Built as nodes, never HTML. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={key}>{p.slice(1, -1)}</em>;
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/15 font-mono text-[12px]"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{p}</span>;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Linkify exact order IDs (ORD-0007 -> /orders/ORD-0007), known variant IDs
 * (-> /inventory/ID), and exact page names (-> their routes). Case-sensitive
 * so ordinary lowercase words never become links.
 */
function linkify(text: string, keyPrefix: string, variantIds: Set<string>): ReactNode[] {
  const pageNames = Object.keys(PAGE_PATHS).map(escapeRegExp).join("|");
  const variantAlt = [...variantIds].map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `\\b(ORD-[A-Z0-9-]+|PF-[A-Za-z0-9-]+)\\b${variantAlt ? `|\\b(${variantAlt})\\b` : ""}|\\b(${pageNames})\\b`,
    "g",
  );
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(...renderInline(text.slice(last, m.index), `${keyPrefix}-t${k++}`));
    const token = m[0];
    const href = PAGE_PATHS[token] ?? (variantIds.has(token) ? `/inventory/${token}` : `/orders/${token}`);
    out.push(
      <Link key={`${keyPrefix}-l${k++}`} href={href} className="underline font-medium">
        {token}
      </Link>,
    );
    last = m.index + token.length;
  }
  if (last < text.length) out.push(...renderInline(text.slice(last), `${keyPrefix}-t${k++}`));
  return out;
}

/** Minimal chat markdown: paragraphs, - / * / numbered lists, ### headings. */
function renderMessage(content: string, variantIds: Set<string>): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = (k: string) => {
    if (!list) return;
    const items = list.items.map((it, j) => (
      <li key={j}>{linkify(it, `${k}-${j}`, variantIds)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={k} className="ml-4 list-decimal space-y-0.5">
          {items}
        </ol>
      ) : (
        <ul key={k} className="ml-4 list-disc space-y-0.5">
          {items}
        </ul>
      ),
    );
    list = null;
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^([-*•])\s+(.*)$/);
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flush(`b${idx}`);
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[2]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flush(`b${idx}`);
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[2]);
    } else if (heading) {
      flush(`b${idx}`);
      blocks.push(
        <p key={`h${idx}`} className="font-semibold">
          {linkify(heading[1], `h${idx}`, variantIds)}
        </p>,
      );
    } else if (trimmed === "") {
      flush(`b${idx}`);
    } else {
      flush(`b${idx}`);
      blocks.push(<p key={`p${idx}`}>{linkify(line, `p${idx}`, variantIds)}</p>);
    }
  });
  flush("bend");
  return <div className="space-y-1">{blocks}</div>;
}
import { subscribeOrders } from "@/lib/services/orders";
import { subscribeInventory } from "@/lib/services/inventory";
import { subscribeUsers } from "@/lib/services/users";
import { subscribeAuditLogs, AUDIT_ACTION_LABELS } from "@/lib/services/audit";
import { getInventoryStatus, isActiveStatus, isStale } from "@/lib/derived";
import type { Order, InventoryItem, User as UserType, AuditLogEntry } from "@/types";

/**
 * Floating AI chat assistant.
 *
 * The browser NEVER talks to OpenRouter directly (that would leak the
 * API key). It POSTs { messages } to our Cloudflare Worker proxy, which
 * holds the key as an encrypted secret and enforces the site origin.
 *
 * Endpoint resolution: NEXT_PUBLIC_AI_CHAT_URL when set, otherwise the
 * deployed Worker URL.
 */
const WORKER_URL = WORKER_BASE_URL;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Always-on formatting instructions (frontend-side, no Worker edit needed). */
const FORMAT_GUIDE =
  "RESPONSE FORMAT: Keep answers short. Use exact page names (Dashboard, Orders, Production, Inventory, Sales, Analytics, Forecasting, Reports, Users, Employees, Audit Log, Settings) and exact order/variant IDs so they become links. Format peso as ₱12,345. Always say whether numbers are all-time or for a date range.";

const PAGE_PATHS: Record<string, string> = {
  Dashboard: "/dashboard",
  Orders: "/orders",
  Production: "/production",
  Inventory: "/inventory",
  Sales: "/sales",
  Analytics: "/analytics",
  Forecasting: "/forecasting",
  Reports: "/reports",
  Users: "/users",
  Employees: "/employees",
  "Audit Log": "/audit",
  Settings: "/settings",
};

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function php(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

/** Full record for an order/variant ID mentioned in the question (drill-down). */
function buildDrillDown(
  text: string,
  orders: Order[],
  inventory: InventoryItem[],
  audit: AuditLogEntry[],
): string | null {
  const parts: string[] = [];
  const orderMatch = text.match(/\b(ORD-[A-Z0-9-]+|PF-[A-Za-z0-9-]+)\b/i);
  if (orderMatch) {
    const id = orderMatch[1].toUpperCase();
    const o = orders.find((x) => (x.order_id ?? "").toUpperCase() === id);
    if (o) {
      const eta = o.estimated_completion
        ? `${o.estimated_completion}${o.based_on?.length ? ` (based on ${o.based_on.join(", ")})` : ""}`
        : "n/a";
      const mats = (o.materials ?? []).map((m) => `${m.material_variant_id} x${m.qty}`).join(", ") || "n/a";
      const history = audit
        .filter((a) => a.record_id === o.order_id)
        .slice(0, 5)
        .map((a) => {
          const label = AUDIT_ACTION_LABELS[a.action] ?? a.action.replace(/_/g, " ");
          return `${label} by ${a.actor_name}`;
        });
      parts.push(
        `FULL RECORD ${o.order_id}: customer ${o.customer_name}, item ${o.item_type} x${o.quantity}, ` +
          `status ${o.status}, priority ${o.priority}, target ${o.target_date}, ETA ${eta}, ` +
          `payment ${php(o.payment_amount ?? 0)} (${o.payment_status ?? "Unpaid"}${o.payment_method ? ` via ${o.payment_method}` : ""}), ` +
          `created ${o.created_at ?? "n/a"}${o.completed_at ? `, completed ${o.completed_at}` : ""}, ` +
          `materials: ${mats}, stock deducted: ${o.stock_deducted ? "yes" : "no"}` +
          `${history.length > 0 ? `, history: ${history.join("; ")}` : ""}.`,
      );
    } else {
      parts.push(`No order found with ID ${orderMatch[1]}.`);
    }
  }
  const upper = text.toUpperCase();
  const variant = inventory.find(
    (i) => i.material_variant_id.length > 0 && upper.includes(i.material_variant_id.toUpperCase()),
  );
  if (variant) {
    parts.push(
      `FULL RECORD ${variant.material_variant_id}: ${variant.item_type} (${variant.category}), ` +
        `status ${getInventoryStatus(variant)}, stock ${variant.current_stock} / ROP ${variant.reorder_point}, ` +
        `forecast 7d ${variant.forecasted_demand_next_7_days} (${variant.model ?? "Holt-Winters"}), ` +
        `sensor ${variant.sensor_id ?? "none"}, tag ${variant.tag_uid ? "bound" : "unbound"}` +
        `${isStale(variant) ? ", DELAYED SYNC (no movement in 12h)" : ""}.`,
    );
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

/** Tagalog/English range phrases -> concrete date window (mirrors Sales page). */
function detectRange(text: string): { label: string; start: string; end: string } | null {
  const t = text.toLowerCase();
  const today = new Date();
  const todayStr = toIso(today);
  const back = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toIso(d);
  };
  if (/nakaraang linggo|last week|past week|ngayong linggo|nitong linggo|this week|last 7 days|past 7 days|7 days/.test(t)) {
    return { label: "last 7 days", start: back(6), end: todayStr };
  }
  if (/ngayong buwan|nitong buwan|this month|nakaraang buwan|last month|past month|last 30 days|past 30 days|30 days/.test(t)) {
    return { label: "last 30 days", start: back(29), end: todayStr };
  }
  if (/quarter|3 months|90 days/.test(t)) {
    return { label: "last 90 days", start: back(89), end: todayStr };
  }
  if (/ngayong taon|this year|taon|last 12 months|365 days/.test(t)) {
    return { label: "last 12 months", start: back(364), end: todayStr };
  }
  if (/kahapon|yesterday/.test(t)) {
    const y = back(1);
    return { label: "yesterday", start: y, end: y };
  }
  if (/\btoday\b|\bngayon\b/.test(t)) {
    return { label: "today", start: todayStr, end: todayStr };
  }
  return null;
}

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! Welcome to Brialyns Art Sign. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live shop snapshot so the bot answers with real numbers.
  // Silent on errors - the chat must never toast or break the page.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let seen = 0;
    // First snapshot OR first error from each feed counts — a denied
    // feed (e.g. audit_logs for non-Owners) must not block the greeting.
    const mark = () => {
      seen += 1;
      if (seen >= 4) setLoaded(true);
    };
    const noisy =
      <T,>(fn: (rows: T) => void) =>
      (rows: T) => {
        fn(rows);
        mark();
      };
    const unsubOrders = subscribeOrders(noisy(setOrders), mark);
    const unsubInv = subscribeInventory(noisy(setInventory), mark);
    const unsubUsers = subscribeUsers(noisy(setUsers), mark);
    // Owner-only collection: Admins get permission-denied here, which is
    // fine — the bot simply won't have activity history for them.
    const unsubAudit = subscribeAuditLogs(noisy(setAuditRows), 50, mark);
    return () => {
      unsubOrders();
      unsubInv();
      unsubUsers();
      unsubAudit();
    };
  }, []);

  const variantIds = useMemo(
    () => new Set(inventory.map((i) => i.material_variant_id)),
    [inventory],
  );

  // Proactive greeting: heads-up on what's urgent, once data arrives and
  // before the user starts chatting.
  useEffect(() => {
    if (!loaded) return;
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].role !== "assistant") return prev;
      if (orders.length === 0 && inventory.length === 0) {
        return [
          {
            role: "assistant",
            content:
              "Hi! Welcome to Brialyns Art Sign. I don't see any shop data yet — create your first order in the cashier POS app, then ask me anything.",
          },
        ];
      }
      const overdue = orders.filter(
        (o) => isActiveStatus(o.status) && o.priority === "Overdue",
      ).length;
      const urgent = orders.filter(
        (o) => isActiveStatus(o.status) && o.priority === "Urgent",
      ).length;
      const reorder = inventory.filter((i) => i.current_stock <= i.reorder_point).length;
      const flags: string[] = [];
      if (overdue > 0) flags.push(`${overdue} overdue order${overdue === 1 ? "" : "s"}`);
      if (urgent > 0) flags.push(`${urgent} urgent`);
      if (reorder > 0) flags.push(`${reorder} material${reorder === 1 ? "" : "s"} need reorder`);
      return [
        {
          role: "assistant",
          content:
            flags.length > 0
              ? `Hi! Welcome to Brialyns Art Sign. Heads up: ${flags.join(", ")} — ask me anything.`
              : "Hi! Welcome to Brialyns Art Sign. All clear — no overdue orders and stocks are healthy. How can I help?",
        },
      ];
    });
  }, [loaded, orders, inventory]);

  const shopContext = useMemo(() => {
    if (orders.length === 0 && inventory.length === 0) return null;
    const php = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;
    const isPaidStatus = (s?: string) => s === "Paid" || s === "Full Paid";
    // Same rule as the Sales page: revenue needs a paid status AND a
    // known payment method; method-less records are excluded.
    const paid = orders.filter((o) => isPaidStatus(o.payment_status) && !!o.payment_method);
    const revenue = paid.reduce((s, o) => s + (o.payment_amount ?? 0), 0);
    const unpaid = orders.filter(
      (o) => !isPaidStatus(o.payment_status) && (o.payment_amount ?? 0) > 0,
    );
    const outstanding = unpaid.reduce((s, o) => s + (o.payment_amount ?? 0), 0);
    const byMethod = (m: string) =>
      paid.filter((o) => o.payment_method === m).reduce((s, o) => s + (o.payment_amount ?? 0), 0);
    const cashierTotals = new Map<string, { total: number; count: number }>();
    for (const o of paid) {
      const key = o.cashier_id ?? "Unknown";
      const cur = cashierTotals.get(key) ?? { total: 0, count: 0 };
      cur.total += o.payment_amount ?? 0;
      cur.count += 1;
      cashierTotals.set(key, cur);
    }
    let topCashier: string | null = null;
    let topTotal = -1;
    for (const [id, t] of cashierTotals) {
      if (t.total > topTotal) {
        topTotal = t.total;
        // Raw 28-char UIDs read as gibberish to the model and get
        // dodged as "no data" — shorten + label honestly instead.
        const name = users.find((u) => u.id === id)?.name ?? `Cashier ${id.slice(-6)} (name not on file)`;
        topCashier = `${name} (${php(t.total)} from ${t.count} sales)`;
      }
    }
    // Active = unfinished (Pending/In Production/Ready for Pickup).
    // Completed and Cancelled are FINISHED — never count them as unfinished.
    // Priority badges render even on finished orders, so the attention
    // list must only consider active ones.
    const activeOrders = orders.filter((o) => isActiveStatus(o.status));
    const countBy = (s: string) => activeOrders.filter((o) => o.status === s).length;
    const completed = orders.filter((o) => o.status === "Completed").length;
    const cancelled = orders.filter((o) => o.status === "Cancelled").length;
    const statusLine =
      `Active/unfinished ${activeOrders.length} ` +
      `(Pending ${countBy("Pending")}, In Production ${countBy("In Production")}, ` +
      `Ready for Pickup ${countBy("Ready for Pickup")}; ` +
      `Finished: Completed ${completed}, Cancelled ${cancelled})`;
    const attention = activeOrders
      .filter((o) => o.priority === "Overdue" || o.priority === "Urgent")
      .slice(0, 6)
      .map((o) => `${o.order_id} (${o.priority}, ${o.status}, ${o.customer_name})`);
    const low = inventory
      .filter((i) => getInventoryStatus(i) !== "In Stock")
      .slice(0, 8)
      .map(
        (i) =>
          `${i.material_variant_id} (${getInventoryStatus(i)}, stock ${i.current_stock} / ROP ${i.reorder_point} → order ${Math.max(0, i.reorder_point - i.current_stock)} units, forecast 7d ${i.forecasted_demand_next_7_days})`,
      );
    const needReorder = inventory.filter((i) => i.current_stock <= i.reorder_point).length;
    const delayed = inventory.filter((i) => isStale(i)).length;
    const lines = [
      `LIVE SHOP DATA for Brialyns Art Sign (ALL-TIME totals unless the user asks for a range; use these real numbers, never invent):`,
      `- Total paid revenue (all time): ${php(revenue)} from ${paid.length} paid orders (Paid/Full Paid with known method).`,
      `- Revenue by method (all time, paid): Cash ${php(byMethod("Cash"))}, E-Wallets ${php(byMethod("E-Wallets"))}, Bank Transfer ${php(byMethod("Bank Transfer"))}.`,
    ];
    if (topCashier) lines.push(`- Top cashier (all time): ${topCashier}.`);
    lines.push(
      `- Outstanding unpaid: ${php(outstanding)} across ${unpaid.length} orders.`,
      `- Orders: ${orders.length} total (${statusLine}).`,
    );
    if (attention.length > 0) lines.push(`- Needs attention: ${attention.join("; ")}.`);
    lines.push(
      low.length > 0
        ? `- Need reorder: ${needReorder} of ${inventory.length} materials. Lowest: ${low.join("; ")}.`
        : `- Inventory: all ${inventory.length} materials in stock.`,
    );
    if (delayed > 0) lines.push(`- Delayed sync: ${delayed} materials with no movement in 12h.`);
    // Owner-only trail (Admins get permission-denied, so this section
    // simply won't exist for them — same as the Audit Log page).
    if (auditRows.length > 0) {
      const recent = auditRows.slice(0, 12).map((a) => {
        const label = AUDIT_ACTION_LABELS[a.action] ?? a.action.replace(/_/g, " ");
        const when = (a.created_at ?? "").slice(0, 10);
        return `${label} ${a.record_label} by ${a.actor_name}${when ? ` (${when})` : ""}`;
      });
      lines.push(`- Recent activity (who did what): ${recent.join("; ")}.`);
    }
    return lines.join("\n");
  }, [orders, inventory, users, auditRows]);

  // Keep the latest reply visible.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending, open]);

  // Focus the box on open; close on Escape.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      // System context rides along so the bot answers with real numbers.
      // The Worker passes roles through. Order: data, drill-down, range,
      // then format guide closest to the conversation.
      const outbound: { role: string; content: string }[] = next
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const drilldown = buildDrillDown(text, orders, inventory, auditRows);
      if (drilldown) outbound.unshift({ role: "system", content: drilldown });
      const range = detectRange(text);
      if (range) {
        const ranged = orders.filter((o) => {
          const paid = o.payment_status === "Paid" || o.payment_status === "Full Paid";
          if (!paid) return false;
          const d = (o.created_at ?? o.target_date ?? "").slice(0, 10);
          return d >= range.start && d <= range.end;
        });
        const sum = ranged.reduce((s, o) => s + (o.payment_amount ?? 0), 0);
        outbound.unshift({
          role: "system",
          content: `Revenue ${range.label} (${range.start} to ${range.end}, by created date): ${php(sum)} from ${ranged.length} paid orders.`,
        });
      }
      if (shopContext) outbound.unshift({ role: "system", content: shopContext });
      outbound.unshift({ role: "system", content: FORMAT_GUIDE });
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outbound }),
      });
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (typeof errJson?.error === "string" && errJson.error.length > 0) {
            detail = errJson.error.slice(0, 200);
          }
        } catch {
          // Keep the generic message.
        }
        throw new Error(detail);
      }
      const data = await res.json();
      const reply: string | undefined = data?.choices?.[0]?.message?.content;
      if (!reply) throw new Error("Empty reply from AI");
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="fixed bottom-5 right-5 z-50 w-13 h-13 p-3.5 rounded-full bg-[#17171c] text-white shadow-lg hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[28rem] max-h-[calc(100vh-7rem)] flex flex-col rounded-2xl border border-printflow-outline-variant bg-printflow-surface shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="AI assistant"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-printflow-outline-variant bg-printflow-surface-container">
            <span className="w-8 h-8 rounded-full bg-[#17171c] text-white flex items-center justify-center shrink-0">
              <Bot className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-printflow-on-surface leading-tight">
                AI Assistant
              </p>
              <p className="text-xs text-printflow-on-surface-variant leading-tight">
                Brialyns Art Sign
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-printflow-on-surface-variant hover:text-printflow-on-surface hover:bg-printflow-surface-container-high"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <span className="w-6 h-6 rounded-full bg-printflow-surface-container flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-printflow-on-surface-variant" />
                  </span>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                    m.role === "user"
                      ? "bg-[#17171c] text-white rounded-br-md whitespace-pre-wrap"
                      : "bg-printflow-surface-container text-printflow-on-surface rounded-bl-md"
                  }`}
                >
                  {m.role === "assistant" ? renderMessage(m.content, variantIds) : m.content}
                </div>
                {m.role === "user" && (
                  <span className="w-6 h-6 rounded-full bg-printflow-surface-container flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-printflow-on-surface-variant" />
                  </span>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex gap-2 justify-start">
                <span className="w-6 h-6 rounded-full bg-printflow-surface-container flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-printflow-on-surface-variant" />
                </span>
                <div className="px-3 py-2.5 rounded-2xl rounded-bl-md bg-printflow-surface-container flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-printflow-on-surface-variant animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-center text-printflow-error bg-printflow-error-container/40 rounded-lg px-2 py-1.5">
                {error} — try again.
              </p>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-printflow-outline-variant">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Ask something..."
                disabled={sending}
                aria-label="Chat message"
                className="flex-1 min-w-0 px-3.5 py-2 text-sm bg-printflow-surface-container rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || input.trim().length === 0}
                aria-label="Send message"
                className="w-9 h-9 rounded-full bg-[#17171c] text-white flex items-center justify-center shrink-0 hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
