/**
 * Not-found page for PrintFlow web.
 *
 * With `output: "export"` in next.config.ts, every dynamic route and
 * unknown URL falls back to this. The Firebase Hosting SPA rewrite
 * (firebase.json) sends hard-refreshes on unknown routes to /index.html,
 * which then renders this through the App Router.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Segoe UI, system-ui, -apple-system, sans-serif",
        background: "#fbf9f4",
        color: "#0b1314",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: "center",
          padding: 24,
          background: "#ffffff",
          border: "1px solid rgba(11, 19, 20, 0.08)",
          borderRadius: 16,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Page not found
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(11, 19, 20, 0.7)",
            margin: "8px 0 20px",
          }}
        >
          That route doesn&apos;t exist in the Brialyns Art Sign panel. Head
          back to the dashboard.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 999,
            background: "#17171c",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
