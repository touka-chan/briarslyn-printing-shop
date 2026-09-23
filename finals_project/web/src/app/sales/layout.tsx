import type { Metadata } from "next";

/** Per-route tab title: renders as "Sales | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Sales" };

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
