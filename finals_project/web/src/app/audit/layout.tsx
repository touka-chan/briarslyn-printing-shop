import type { Metadata } from "next";

/** Per-route tab title: renders as "Audit Log | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Audit Log" };

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
