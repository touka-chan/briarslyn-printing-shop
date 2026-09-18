#!/usr/bin/env node
/**
 * seed_bom.mjs - one-shot Bill of Materials seeder for PrintFlow.
 *
 * Writes `bom/{normalized_item_type}` docs consumed by the auto-deduct
 * engine (web `lib/services/usage.ts` + mobile `UsageService`): when an
 * order enters "In Production", each line deducts
 * ceil(qty_per_unit x orderQty) from the mapped variant.
 *
 * Coverage is deliberate: only products with stocked variants get a BOM.
 * `tote_bag`, `cap`, and `custom` have NO recipe on purpose - orders for
 * those items exercise the designed no-BOM path (status proceeds with a
 * "log usage manually" warning instead of an auto-deduct).
 *
 * How to run (same env as seed.mjs):
 *   1. `web/.env.local` needs NEXT_PUBLIC_FIREBASE_* plus
 *      SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (Owner account).
 *   2. From `web/`: `node scripts/seed_bom.mjs`
 *   3. Idempotent: stable doc ids, re-running overwrites.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
if (!existsSync(ENV_PATH)) {
  console.error(`[seed:bom] ${ENV_PATH} not found.`);
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

const missing = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "SEED_OWNER_EMAIL",
  "SEED_OWNER_PASSWORD",
].filter((k) => !env[k]);
if (missing.length) {
  console.error(`[seed:bom] Missing env vars: ${missing.join(", ")}`);
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
});
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[seed:bom] Signing in as ${env.SEED_OWNER_EMAIL}...`);
await signInWithEmailAndPassword(
  auth,
  env.SEED_OWNER_EMAIL,
  env.SEED_OWNER_PASSWORD,
);

const normalize = (s) => s.toLowerCase().trim().replace(/\s+/g, "_");

// item_type (as the POS cashier app offers them) - recipe lines.
// Fractional qty_per_unit allowed; consumption rounds UP per line.
const boms = [
  {
    item_type: "T-Shirt",
    lines: [
      { material_variant_id: "SHIRT-BLANK-WHITE-M", qty_per_unit: 1 },
      { material_variant_id: "INK-BLACK", qty_per_unit: 0.05 },
    ],
  },
  {
    item_type: "Hoodie",
    lines: [
      { material_variant_id: "SHIRT-BLANK-BLACK-L", qty_per_unit: 1 },
      { material_variant_id: "INK-BLACK", qty_per_unit: 0.05 },
    ],
  },
  {
    item_type: "Mug",
    lines: [{ material_variant_id: "MUG-WHITE-11OZ", qty_per_unit: 1 }],
  },
  {
    item_type: "Sticker",
    lines: [
      { material_variant_id: "PAPER-GLOSSY-A3", qty_per_unit: 0.1 },
      { material_variant_id: "INK-CYAN", qty_per_unit: 0.02 },
    ],
  },
  {
    item_type: "Poster",
    lines: [
      { material_variant_id: "PAPER-GLOSSY-A3", qty_per_unit: 1 },
      { material_variant_id: "INK-CYAN", qty_per_unit: 0.05 },
    ],
  },
  {
    item_type: "Tarpaulin - Medium",
    lines: [{ material_variant_id: "TARP-MED", qty_per_unit: 1 }],
  },
  {
    item_type: "Tarpaulin - Small",
    lines: [{ material_variant_id: "TARP-SMALL", qty_per_unit: 1 }],
  },
  {
    item_type: "Tarpaulin - Large",
    lines: [{ material_variant_id: "TARP-LARGE", qty_per_unit: 1 }],
  },
  {
    item_type: "Paper - A4 80gsm",
    lines: [{ material_variant_id: "PAPER-A4-80GSM", qty_per_unit: 2 }],
  },
];

for (const bom of boms) {
  const id = normalize(bom.item_type);
  await setDoc(doc(db, "bom", id), {
    item_type: bom.item_type,
    lines: bom.lines,
    updated_at: Timestamp.now(),
    updated_by: auth.currentUser?.uid ?? null,
  });
  console.log(
    `[seed:bom] bom/${id} - ${bom.lines
      .map((l) => `${l.qty_per_unit}x ${l.material_variant_id}`)
      .join(", ")}`,
  );
}
console.log(`[seed:bom] Done. ${boms.length} recipes.`);
process.exit(0);
