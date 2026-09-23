import type { Metadata } from "next";

/** Per-route tab title: renders as "Reports | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Reports" };

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
