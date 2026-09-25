#!/usr/bin/env node
/**
 * migrate_order_ids.mjs - one-shot rename of legacy order doc ids (the
 * long random Firestore ids) to the sequential ORD-0001 format.
 *
 * What it does:
 *   1. Signs in as the Owner (same env vars as scripts/seed.mjs).
 *   2. Reads every doc in `orders`, sorts the legacy ones (ids that are
 *      not ORD-NNNN) by `created_at` ascending and maps them to
 *      ORD-0001, ORD-0002, ... after any ids that already exist.
 *   3. With --apply: seeds `counters/orders` first (so a new order made
 *      during the window gets the NEXT number, never a collision), then
 *      creates the renamed docs with the exact same data plus an
 *      `order_id` field matching the new id.
 *
 * The old docs are NOT deleted here: `orders` has `allow delete: false`
 * in firestore.rules. The script prints the exact
 * `firebase firestore:delete` commands (the CLI uses the Firestore
 * Admin API, which bypasses security rules) - run them after checking
 * the new docs look right.
 *
 * Usage (from web/):
 *   node scripts/migrate_order_ids.mjs            # dry run, prints the plan
 *   node scripts/migrate_order_ids.mjs --apply    # write the new docs
 *
 * Re-running is safe: legacy docs already renamed are skipped, and the
 * counter is only moved forward.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---- env -----------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
if (!existsSync(ENV_PATH)) {
  console.error(`[migrate] ${ENV_PATH} not found. Copy .env.local.example and fill it in.`);
  process.exit(1);
}

const envRaw = readFileSync(ENV_PATH, "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  if (m[1].startsWith("#")) continue;
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
  console.error(`[migrate] Missing env vars in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const apply = process.argv.includes("--apply");

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ---- firebase init -------------------------------------------------------

const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} = await import("firebase/firestore");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[migrate] Signing in as ${env.SEED_OWNER_EMAIL}...`);
await signInWithEmailAndPassword(auth, env.SEED_OWNER_EMAIL, env.SEED_OWNER_PASSWORD);
console.log(`[migrate] Signed in.${apply ? "" : " DRY RUN - nothing will be written."}`);

// ---- helpers -------------------------------------------------------------

const ORDER_ID_RE = /^ORD-\d{4,}$/;
const formatOrderId = (n) => `ORD-${String(n).padStart(4, "0")}`;

function createdMs(data) {
  const v = data.created_at;
  if (v && typeof v.toMillis === "function") return v.toMillis();
  if (v && typeof v.seconds === "number") return v.seconds * 1000;
  return 0;
}

function label(data) {
  return `${data.customer_name ?? "?"} - ${data.item_type ?? "?"} x${data.quantity ?? "?"}`;
}

// ---- read ----------------------------------------------------------------

const ordersSnap = await getDocs(collection(db, "orders"));
const legacy = [];
const sequenced = [];

for (const d of ordersSnap.docs) {
  const data = d.data();
  if (ORDER_ID_RE.test(d.id)) sequenced.push({ id: d.id, data });
  else legacy.push({ id: d.id, data });
}

legacy.sort((a, b) => {
  const d = createdMs(a.data) - createdMs(b.data);
  return d !== 0 ? d : a.id.localeCompare(b.id);
});

const counterSnap = await getDoc(doc(db, "counters", "orders"));
const counterLast = Number(counterSnap.data()?.last ?? 0);
const maxSequenced = sequenced.reduce((max, o) => {
  const n = Number(o.id.slice(4));
  return Number.isFinite(n) && n > max ? n : max;
}, 0);
const base = Math.max(counterLast, maxSequenced);

console.log(`[migrate] orders: ${ordersSnap.size} total, ${legacy.length} legacy, ${sequenced.length} already ORD-XXXX`);
console.log(`[migrate] counter last=${counterLast}, highest existing id=${maxSequenced} -> new numbers start at ${base + 1}`);

if (legacy.length === 0) {
  console.log("[migrate] Nothing to rename. Done.");
  process.exit(0);
}

const plan = legacy.map((o, i) => ({ ...o, newId: formatOrderId(base + i + 1) }));

console.log("\n[migrate] Plan (oldest first):");
for (const p of plan) {
  console.log(`  ${p.id}  ->  ${p.newId}   [${label(p.data)}]`);
}

if (!apply) {
  console.log("\n[migrate] Dry run only. Re-run with --apply to write.");
  process.exit(0);
}

// ---- apply ---------------------------------------------------------------

// Move the counter FIRST: any order created during this window takes the
// next number instead of colliding with a renamed one.
const newLast = base + plan.length;
await setDoc(
  doc(db, "counters", "orders"),
  { last: newLast, updated_at: serverTimestamp() },
  { merge: true },
);
console.log(`\n[migrate] counters/orders.last = ${newLast}`);

for (const p of plan) {
  const target = doc(db, "orders", p.newId);
  const exists = await getDoc(target);
  if (exists.exists()) {
    console.error(`[migrate] ABORT: ${p.newId} already exists - nothing was overwritten.`);
    process.exit(1);
  }
  const data = { ...p.data, order_id: p.newId };
  await setDoc(target, data);
  console.log(`[migrate] created orders/${p.newId}`);
}

console.log("\n[migrate] New docs written. Now delete the old docs with the Firebase CLI:");
for (const p of plan) {
  console.log(`  firebase firestore:delete "orders/${p.id}" --force`);
}
console.log("\n[migrate] After deleting, check the Orders page - ids should read ORD-0001..");
process.exit(0);
