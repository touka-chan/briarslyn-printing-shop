import type { Metadata } from "next";

/** Per-route tab title: renders as "Users | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Users" };

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
