import type { Metadata } from "next";

/**
 * Per-route tab title: renders as "Order Details | Brialyns Art Sign".
 * `absolute` is used because the root title template is not applied to
 * dynamic-segment layouts during static export (verified in web/out).
 */
export const metadata: Metadata = {
  title: { absolute: "Order Details | Brialyns Art Sign" },
};

export default function OrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
