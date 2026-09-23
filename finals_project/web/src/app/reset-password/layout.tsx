import type { Metadata } from "next";

/** Per-route tab title: renders as "Reset Password | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
