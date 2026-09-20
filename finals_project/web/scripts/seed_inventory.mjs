#!/usr/bin/env node
/**
 * seed_inventory.mjs - inventory-only seeder (10 test variants).
 *
 * Writes ONLY to the `inventory` collection (stable doc ids, so
 * re-running overwrites without duplicates). Unlike seed.mjs, this does
 * NOT touch orders / users / employees / rfid_events.
 *
 * Status follows the unified rule (web getInventoryStatus):
 *   stock <= floor(ROP * 0.6) -> "Insufficient Stock"
 *   stock <= ROP              -> "Low Stock"
 *   else                      -> "In Stock"
 * No `threshold` field (removed from the app contract).
 *
 * Run from `web/`: `node scripts/seed_inventory.mjs`
 * Needs web/.env.local with NEXT_PUBLIC_FIREBASE_* plus
 * SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
if (!existsSync(ENV_PATH)) {
  console.error(`[seed-inv] ${ENV_PATH} not found.`);
  process.exit(1);
}

const envRaw = readFileSync(ENV_PATH, "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m || m[1].startsWith("#")) continue;
  let v = m[2];
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "SEED_OWNER_EMAIL",
  "SEED_OWNER_PASSWORD",
];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`[seed-inv] Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const { getFirestore, doc, setDoc, Timestamp } = await import(
  "firebase/firestore"
);

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[seed-inv] Signing in as ${env.SEED_OWNER_EMAIL}...`);
await signInWithEmailAndPassword(
  auth,
  env.SEED_OWNER_EMAIL,
  env.SEED_OWNER_PASSWORD,
);
console.log("[seed-inv] Signed in.");

function statusFor(stock, rop) {
  if (stock <= Math.floor(rop * 0.6)) return "Insufficient Stock";
  if (stock <= rop) return "Low Stock";
  return "In Stock";
}

const now = Date.now();
const DAY = 86400000;
const ts = (ms) => Timestamp.fromMillis(ms);

// 10 test variants across statuses: 4 In Stock, 3 Low, 3 Insufficient.
// One stale (>12h since last update) to exercise the Delayed Sync tile.
const items = [
  { id: "TEST-TARP-01", item: "Test Tarpaulin Small", cat: "Tarpaulin", stock: 30, rop: 10, f7d: 12, updated: ts(now) },
  { id: "TEST-TARP-02", item: "Test Tarpaulin Medium", cat: "Tarpaulin", stock: 3, rop: 10, f7d: 14, updated: ts(now) },
  { id: "TEST-SHIRT-01", item: "Test Shirt White", cat: "Shirt", stock: 50, rop: 20, f7d: 22, updated: ts(now) },
  { id: "TEST-SHIRT-02", item: "Test Shirt Black", cat: "Shirt", stock: 0, rop: 15, f7d: 18, updated: ts(now) },
  { id: "TEST-MUG-01", item: "Test Mug 11oz", cat: "Mug", stock: 9, rop: 12, f7d: 10, updated: ts(now) },
  { id: "TEST-INK-01", item: "Test Ink Black", cat: "Ink", stock: 2, rop: 8, f7d: 9, updated: ts(now - 20 * 3600000) },
  { id: "TEST-INK-02", item: "Test Ink Cyan", cat: "Ink", stock: 25, rop: 8, f7d: 6, updated: ts(now) },
  { id: "TEST-PAPER-01", item: "Test Paper A4", cat: "Paper", stock: 200, rop: 60, f7d: 55, updated: ts(now) },
  { id: "TEST-PAPER-02", item: "Test Paper Glossy", cat: "Paper", stock: 12, rop: 20, f7d: 16, updated: ts(now) },
  { id: "TEST-STICKER-01", item: "Test Sticker Vinyl", cat: "Stickers", stock: 5, rop: 12, f7d: 11, updated: ts(now) },
];

let n = 0;
for (const v of items) {
  const status = statusFor(v.stock, v.rop);
  await setDoc(doc(db, "inventory", v.id), {
    material_variant_id: v.id,
    item_type: v.item,
    category: v.cat,
    tag_uid: null,
    sensor_id: null,
    current_stock: v.stock,
    reorder_point: v.rop,
    forecasted_demand_next_7_days: v.f7d,
    model: "Exponential Smoothing",
    status,
    last_updated: v.updated,
    last_checkout_at: null,
  });
  n++;
  console.log(`[seed-inv] inventory/${v.id} stock=${v.stock} rop=${v.rop} (${status})`);
}
console.log(`[seed-inv] Done. ${n} variants written (idempotent).`);
process.exit(0);
