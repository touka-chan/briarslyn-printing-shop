import type { Metadata } from "next";

/** Per-route tab title: renders as "Forecasting | Brialyns Art Sign". */
export const metadata: Metadata = { title: "Forecasting" };

export default function ForecastingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
