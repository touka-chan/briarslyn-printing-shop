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
}

interface ToastContextValue {
 success: (message: string) => void;
 error: (message: string) => void;
 info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; ring: string; iconClass: string }> = {
 success: {
  icon: CheckCircle2,
  ring: "border-printflow-success/30",
  iconClass: "text-printflow-success",
 },
 error: {
  icon: AlertTriangle,
  ring: "border-printflow-error/30",
  iconClass: "text-printflow-error",
 },
 info: {
  icon: Info,
  ring: "border-printflow-primary/30",
  iconClass: "text-printflow-primary",
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
  (variant: ToastVariant, message: string) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  setToasts((prev) => [...prev, { id, message, variant }]);
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
  success: (m) => push("success", m),
  error: (m) => push("error", m),
  info: (m) => push("info", m),
  }),
  [push],
 );

 return (
  <ToastContext.Provider value={value}>
  {children}
  <div
   className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none"
   aria-live="polite"
   aria-atomic="true"
  >
   {toasts.map((t) => {
   const style = VARIANT_STYLES[t.variant];
   const Icon = style.icon;
   return (
    <div
     key={t.id}
     className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border ${style.ring} bg-printflow-surface shadow-lg`}
     style={{ animation: "slide-in-right 220ms ease-out" }}
     role="status"
    >
     <Icon className={`w-5 h-5 shrink-0 ${style.iconClass}`} />
     <p className="flex-1 text-sm text-printflow-on-surface leading-snug">
      {t.message}
     </p>
     <button
      onClick={() => dismiss(t.id)}
      className="text-printflow-on-surface-variant hover:text-printflow-on-surface transition-colors"
      aria-label="Dismiss notification"
     >
      <X className="w-4 h-4" />
     </button>
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
