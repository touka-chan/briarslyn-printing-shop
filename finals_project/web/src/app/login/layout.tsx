import type { Metadata } from "next";

/** Per-route tab title: renders as "Sign In | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Sign In" };

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
