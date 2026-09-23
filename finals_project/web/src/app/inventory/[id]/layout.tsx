import type { Metadata } from "next";

/**
 * Per-route tab title: renders as "Inventory Details | Brialyns Art Sign".
 * `absolute` is used because the root title template is not applied to
 * dynamic-segment layouts during static export (verified in web/out).
 */
export const metadata: Metadata = {
  title: { absolute: "Inventory Details | Brialyns Art Sign" },
};

export default function InventoryDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
