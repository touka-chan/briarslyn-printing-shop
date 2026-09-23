import type { Metadata } from "next";

/** Per-route tab title: renders as "Analytics | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
