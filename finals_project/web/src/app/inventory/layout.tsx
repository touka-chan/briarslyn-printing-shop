import type { Metadata } from "next";

/** Per-route tab title: renders as "Inventory | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Inventory" };

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
