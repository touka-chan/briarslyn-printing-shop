/**
 * Facebook-style tab badge for the header's live-activity notifications.
 *
 * While the panel tab is in the background, incoming changes:
 *   - prepend "(3) " to the tab title, and
 *   - paint a red count bubble onto the favicon.
 * Both clear the moment the tab becomes visible or the bell is opened.
 *
 * Kept out of React entirely: the browser only reads the DOM title and
 * favicon, so a module with a MutationObserver (which re-applies the
 * prefix when Next swaps the per-page title) is enough - and it survives
 * the header remounting on every navigation.
 *
 * Client-only: every entry point no-ops during prerender / non-DOM runs.
 */

let count = 0;
let titleObserver: MutationObserver | null = null;
let logoImage: HTMLImageElement | null = null;
let logoLoaded = false;
let iconOriginals: { el: HTMLLinkElement; href: string }[] | null = null;

/** App error token when available, else a standard notification red. */
function badgeColor(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-printflow-error")
      .trim();
    return value || "#dc2626";
  } catch {
    return "#dc2626";
  }
}

function iconLinks(): HTMLLinkElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']"),
  );
}

function drawFavicon(): void {
  const links = iconLinks();
  if (links.length === 0) return;
  if (!iconOriginals) {
    iconOriginals = links.map((el) => ({ el, href: el.href }));
  }
  if (count <= 0) {
    for (const it of iconOriginals) {
      if (it.el.isConnected) it.el.href = it.href;
    }
    return;
  }
  if (!logoImage) {
    // One shared image; repaint when it arrives.
    logoImage = new Image();
    logoImage.onload = () => {
      logoLoaded = true;
      drawFavicon();
    };
    logoImage.src = "/logo.jpg";
    return;
  }
  if (!logoLoaded) return;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(logoImage, 0, 0, size, size);

  const label = count > 9 ? "9+" : String(count);
  const r = 22;
  const cx = size - r - 2;
  const cy = r + 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 1);

  const url = canvas.toDataURL("image/png");
  for (const it of iconOriginals) {
    if (it.el.isConnected) it.el.href = url;
  }
}

function syncTitle(): void {
  const stripped = document.title.replace(/^\(\d+\)\s*/, "");
  const want = count > 0 ? `(${count}) ${stripped}` : stripped;
  if (document.title !== want) document.title = want;
}

function ensureObserver(): void {
  if (titleObserver) return;
  const titleEl = document.querySelector("title");
  if (!titleEl) return;
  // Re-apply the prefix whenever Next swaps the per-page title.
  titleObserver = new MutationObserver(syncTitle);
  titleObserver.observe(titleEl, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function render(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  ensureObserver();
  syncTitle();
  drawFavicon();
}

/** Adds `delta` (usually 1 per change) and returns the new count. */
export function bumpTabBadge(delta: number): number {
  count = Math.max(0, count + delta);
  render();
  return count;
}

/** Clears the badge (tab visible / bell opened) and returns 0. */
export function clearTabBadge(): number {
  count = 0;
  render();
  return count;
}

/** Current unread count (0 when nothing pending). */
export function getTabBadge(): number {
  return count;
}
