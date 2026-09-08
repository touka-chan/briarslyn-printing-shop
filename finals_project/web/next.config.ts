import type { NextConfig } from "next";

/**
 * PrintFlow web dashboard — Next.js config.
 *
 * `output: "export"` switches `next build` from a Node server to a static
 * export. The output goes to `web/out/`, which `firebase.json` points at
 * for Firebase Hosting. All data is client-side (Firestore SDK), so we
 * lose nothing by going static.
 *
 * `trailingSlash: true` makes routes look like `/dashboard/`, which pairs
 * with the SPA rewrite in `firebase.json` so hard-refreshes on any route
 * serve `index.html` instead of 404'ing.
 *
 * `images: { unoptimized: true }` silences the build-time warning about
 * `next/image` needing a server, since we have no `<Image>` components
 * (verified — none in `web/src/`).
 *
 * `env.NEXT_PUBLIC_BUILD_ID` is stamped from the `BUILD_ID` env var (or
 * the current unix timestamp as a fallback) so the runtime address loader
 * can append `?v=<buildId>` to its JSON fetches. That breaks browser cache
 * on every deploy — without it, a stale cached 404 (from a build where the
 * JSON was missing) can persist in the user's browser and leave the
 * address cascade permanently empty until they clear site data.
 */
const buildId = process.env.BUILD_ID || String(Date.now());

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
