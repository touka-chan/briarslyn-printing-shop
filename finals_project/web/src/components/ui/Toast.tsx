"use client";

import {
 createContext,
 ReactNode,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useRef,
 useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
 id: string;
 message: string;
 variant: ToastVariant;
 /** Optional heading override (defaults to the variant's title). */
 title?: string;
}

interface ToastContextValue {
 success: (message: string, title?: string) => void;
 error: (message: string, title?: string) => void;
 info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
 ToastVariant,
 {
  icon: typeof CheckCircle2;
  title: string;
  badge: string;
  iconClass: string;
  bar: string;
 }
> = {
 success: {
  icon: CheckCircle2,
  title: "Success",
  badge: "bg-printflow-success-container text-printflow-success",
  iconClass: "text-printflow-success",
  bar: "bg-printflow-success",
 },
 error: {
  icon: AlertTriangle,
  title: "Something went wrong",
  badge: "bg-printflow-error-container text-printflow-on-error-container",
  iconClass: "text-printflow-on-error-container",
  bar: "bg-printflow-on-error-container",
 },
 info: {
  icon: Info,
  title: "Heads up",
  badge: "bg-printflow-primary-fixed text-printflow-on-primary-fixed",
  iconClass: "text-printflow-on-primary-fixed",
  bar: "bg-printflow-on-primary-fixed",
 },
};

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
 const [toasts, setToasts] = useState<ToastItem[]>([]);
 const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

 const dismiss = useCallback((id: string) => {
  setToasts((prev) => prev.filter((t) => t.id !== id));
  const handle = timers.current.get(id);
  if (handle) {
  clearTimeout(handle);
  timers.current.delete(id);
  }
 }, []);

  const push = useCallback(
   (variant: ToastVariant, message: string, title?: string) => {
   const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
   setToasts((prev) => [...prev, { id, message, variant, title }]);
   const handle = setTimeout(() => dismiss(id), DEFAULT_DURATION);
   timers.current.set(id, handle);
   },
   [dismiss],
  );

 useEffect(() => {
  return () => {
  timers.current.forEach((h) => clearTimeout(h));
  timers.current.clear();
  };
 }, []);

  const value = useMemo<ToastContextValue>(
   () => ({
   success: (m, t) => push("success", m, t),
   error: (m, t) => push("error", m, t),
   info: (m, t) => push("info", m, t),
   }),
   [push],
  );

 return (
  <ToastContext.Provider value={value}>
  {children}
  <div
   className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none print:hidden"
   aria-live="polite"
   aria-atomic="true"
  >
   {toasts.map((t) => {
   const style = VARIANT_STYLES[t.variant];
   const Icon = style.icon;
   return (
    <div
     key={t.id}
     className="pointer-events-auto relative overflow-hidden rounded-2xl border border-printflow-outline-variant/50 bg-printflow-surface shadow-[0_16px_40px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)]"
     style={{ animation: "toast-in 260ms cubic-bezier(0.21, 1.02, 0.73, 1)" }}
     role="status"
    >
     <div className="flex items-start gap-3 px-4 pt-3.5 pb-4">
      <span
       className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${style.badge}`}
      >
       <Icon className="w-5 h-5" />
      </span>
       <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-printflow-on-surface leading-tight">
         {t.title ?? style.title}
        </p>
       <p className="mt-0.5 text-sm text-printflow-on-surface-variant leading-snug">
        {t.message}
       </p>
      </div>
      <button
       onClick={() => dismiss(t.id)}
       className="p-1 -m-1 rounded-full text-printflow-on-surface-variant/70 hover:text-printflow-on-surface hover:bg-printflow-surface-container transition-colors shrink-0"
       aria-label="Dismiss notification"
      >
       <X className="w-4 h-4" />
      </button>
     </div>
     {/* Lifetime progress bar */}
     <div className="h-1 w-full bg-printflow-surface-container">
      <div
       className={`h-full ${style.bar} opacity-70`}
       style={{
        animation: `toast-progress ${DEFAULT_DURATION}ms linear forwards`,
       }}
      />
     </div>
    </div>
   );
   })}
  </div>
  </ToastContext.Provider>
 );
}

export function useToast(): ToastContextValue {
 const ctx = useContext(ToastContext);
 if (!ctx) {
  // Safe fallback so calls outside provider don't crash during dev
  return {
  success: () => {},
  error: () => {},
  info: () => {},
  };
 }
 return ctx;
}
