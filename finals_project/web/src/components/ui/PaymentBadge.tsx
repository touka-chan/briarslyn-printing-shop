import { ReactNode } from "react";
import { PaymentStatusLabel } from "@/types";

export type PaymentStatus =
  | "paid"
  | "full-paid"
  | "unpaid"
  | "incomplete"
  | "partial"
  | "partially-paid";

interface PaymentBadgeProps {
  status: PaymentStatus;
  children?: ReactNode;
  className?: string;
}

const CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "payment-paid",
  },
  "full-paid": {
    // POS term - shown verbatim so the web mirrors the cashier's screen.
    label: "Full Paid",
    className: "payment-paid",
  },
  partial: {
    label: "Partial",
    className: "payment-partial",
  },
  "partially-paid": {
    // Canonical POS term - shown verbatim like the cashier's screen.
    label: "Partially Paid",
    className: "payment-partial",
  },
  incomplete: {
    // POS term - partial-payment state with a balance still owed.
    label: "Incomplete",
    className: "payment-partial",
  },
  unpaid: {
    label: "Unpaid",
    className: "payment-unpaid",
  },
};

export function PaymentBadge({
  status,
  children,
  className = "",
}: PaymentBadgeProps) {
  // Fallback: direct use with an unlisted status renders neutral
  // instead of crashing (all current callers go through toPaymentStatus).
  const config = CONFIG[status] ?? {
    label: status,
    className: "payment-unpaid",
  };
  return (
    <span
      className={`status-badge ${config.className} ${className}`.trim()}
      aria-label={`Payment: ${config.label}`}
    >
      {children ?? config.label}
    </span>
  );
}

/**
 * Normalizes a `payment_status` string from the POS or web's Order contract
 * into the canonical kebab-case `PaymentStatus` used by this component.
 *
 * "Paid" / "Full Paid" - fully-paid (success tone). "Partial" /
 * "Partially Paid" / "Incomplete" - partial (warning tone). "Unpaid" -
 * unpaid (error tone). Anything else, including `undefined`, falls back
 * to "unpaid".
 */
export function toPaymentStatus(
  s: PaymentStatusLabel | string | undefined | null,
): PaymentStatus {
  if (!s) return "unpaid";
  const norm = String(s).trim().toLowerCase().replace(/\s+/g, "-");
  switch (norm) {
    case "paid":
      return "paid";
    case "full-paid":
    case "fullpaid":
    case "full_paid":
      return "full-paid";
    case "partially-paid":
      return "partially-paid";
    case "partial":
      return "partial";
    case "incomplete":
      return "incomplete";
    case "unpaid":
    default:
      return "unpaid";
  }
}
