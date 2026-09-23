import type { Metadata } from "next";

/** Per-route tab title: renders as "Settings | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
