import type { Metadata } from "next";

/** Per-route tab title: renders as "Employees | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Employees" };

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
