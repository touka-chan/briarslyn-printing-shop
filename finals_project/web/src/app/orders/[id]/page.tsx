import OrderDetail from "./page-client";

// Static export requires at least one pre-rendered path per dynamic route.
// We emit a single placeholder id; the SPA rewrite + the client-side router
// pick up every real id at runtime from the URL.
export function generateStaticParams() {
 return [{ id: "_" }];
}

export default function Page() {
 return <OrderDetail />;
}
