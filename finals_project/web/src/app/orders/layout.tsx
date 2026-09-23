import type { Metadata } from "next";

/** Per-route tab title: renders as "Orders | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Orders" };

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
