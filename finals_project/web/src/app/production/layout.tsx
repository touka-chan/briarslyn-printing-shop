import type { Metadata } from "next";

/** Per-route tab title: renders as "Production | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Production" };

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
