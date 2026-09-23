import type { Metadata } from "next";

/** Per-route tab title: renders as "Dashboard | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
