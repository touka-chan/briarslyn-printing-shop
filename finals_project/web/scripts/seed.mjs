#!/usr/bin/env node
/**
 * seed.mjs - one-shot Firestore seeder for PrintFlow.
 *
 * What it writes (in this order):
 *   1. users/{uid}       - the Owner's profile doc (uid comes from the Auth
 *                          account already created in Firebase Auth). Also
 *                          one extra "Cashier 01" / "Production 01" profile
 *                          doc under the matching auth uids.
 *   2. employees/{auto}  - 3 HR records (no Auth accounts, just info).
 *   3. orders/{orderId}  - 8 sample orders, with priority/ETA recomputed
 *                          for "today" so the data feels current.
 *   4. inventory/{vid}   - 10 material variants.
 *   5. rfid_events/{auto}- 5 sample RFID checkout events (best-effort; the
 *                          collection is service-account-only in prod, but
 *                          a signed-in Owner can also write to it for demo).
 *
 * How to run:
 *   1. Make sure `web/.env.local` has the NEXT_PUBLIC_FIREBASE_* values AND
 *      SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (the same email + password you
 *      use to sign in to the web app as the Owner).
 *   2. From `web/`: `node scripts/seed.mjs`
 *   3. The script is idempotent: each `setDoc` uses a stable id, so re-running
 *      overwrites the existing docs without creating duplicates.
 *
 * Why a script (not the web app): the web app's orders / inventory collections
 * are read by the live UI; an empty Firestore is the default state for a new
 * project. This script fills it with realistic fixtures so you can demo /
 * develop / test against real data. Run `seed_bom.mjs` too for recipes.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---- env -----------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
if (!existsSync(ENV_PATH)) {
  console.error(`[seed] ${ENV_PATH} not found. Copy .env.local.example and fill it in.`);
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
  console.error(`[seed] Missing env vars in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

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
const { getFirestore, doc, setDoc, Timestamp, collection } = await import(
  "firebase/firestore"
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[seed] Signing in as ${env.SEED_OWNER_EMAIL}...`);
const cred = await signInWithEmailAndPassword(
  auth,
  env.SEED_OWNER_EMAIL,
  env.SEED_OWNER_PASSWORD,
);
const ownerUid = cred.user.uid;
console.log(`[seed] Signed in. uid = ${ownerUid}`);

// ---- helpers -------------------------------------------------------------

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(target) {
  const t = new Date(target + "T00:00:00Z").getTime();
  return Math.floor((t - TODAY.getTime()) / 86400000);
}

function getPriority(target) {
  const d = diffDays(target);
  if (d < 0) return "Overdue";
  if (d <= 2) return "Urgent";
  return "Upcoming";
}

function getEta(target, priority) {
  let add = 2;
  let basedOn = ["job_complexity", "capacity"];
  if (priority === "Overdue") {
    add = 2;
    basedOn = ["backlog", "job_complexity", "capacity"];
  } else if (priority === "Urgent") {
    add = 1;
    basedOn = ["backlog", "capacity"];
  }
  return { estimated_completion: addDays(target, add), based_on: basedOn };
}

function getInvStatus(item) {
  if (item.current_stock <= item.reorder_point) {
    return item.current_stock <= Math.ceil(item.reorder_point * 0.6)
      ? "Insufficient Stock"
      : "Low Stock";
  }
  return "In Stock";
}

function isStale(lastUpdated) {
  const hrs = (TODAY.getTime() - new Date(lastUpdated).getTime()) / 3600000;
  return hrs > 12;
}

const fmt = (d) => (d instanceof Date ? d.toISOString() : d);
const todayIso = (offset = 0) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

// ---- seed payloads -------------------------------------------------------

// Rebase dates so the orders feel current: scatter them across today-3 to
// today+5 days so we get a mix of Overdue / Urgent / Upcoming priorities.
const orderSeeds = [
  {
    order_id: "ORD-1023",
    customer_name: "Juan Dela Cruz",
    customer_email: "juan.delacruz@gmail.com",
    customer_phone: "0917-123-4567",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "Sta. Cruz",
    customer_barangay: "Pagsawitan",
    customer_zip: "4009",
    payment_amount: 1500,
    payment_status: "Unpaid",
    payment_method: "Cash",
    item_type: "T-shirt Printing",
    quantity: 20,
    layout_file: "layout01.png",
    target_date: todayIso(-2),
    status: "Pending",
    cashier_id: null,
  },
  {
    order_id: "ORD-1024",
    customer_name: "Acme Corporation",
    customer_email: "orders@acme.com",
    customer_phone: "0918-234-5678",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "Calamba",
    customer_barangay: "Parian",
    customer_zip: "4027",
    payment_amount: 2500,
    payment_status: "Partial",
    payment_method: "Bank Transfer",
    item_type: "Tarpaulin - Medium",
    quantity: 5,
    layout_file: "layout02.png",
    target_date: todayIso(0),
    status: "In Production",
    cashier_id: null,
  },
  {
    order_id: "ORD-1025",
    customer_name: "Global Logistics",
    customer_email: "procurement@globallogistics.ph",
    customer_phone: "0919-345-6789",
    customer_region: "NCR",
    customer_province: "Metro Manila",
    customer_city: "Quezon City",
    customer_barangay: "Diliman",
    customer_zip: "1101",
    payment_amount: 4500,
    payment_status: "Paid",
    payment_method: "Bank Transfer",
    item_type: "Tarpaulin - Large",
    quantity: 10,
    layout_file: "layout03.png",
    target_date: todayIso(5),
    status: "Pending",
    cashier_id: null,
  },
  {
    order_id: "PF-2024-001",
    customer_name: "Acme Corporation",
    customer_email: "orders@acme.com",
    customer_phone: "0918-234-5678",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "Calamba",
    customer_barangay: "Parian",
    customer_zip: "4027",
    payment_amount: 3500,
    payment_status: "Paid",
    payment_method: "Bank Transfer",
    item_type: "Tarpaulin - Small",
    quantity: 5000,
    layout_file: "business-cards-premium.png",
    target_date: todayIso(-1),
    status: "Completed",
    cashier_id: null,
  },
  {
    order_id: "PF-2024-002",
    customer_name: "TechStart Inc",
    customer_email: "hello@techstart.ph",
    customer_phone: "0920-456-7890",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "Los Baños",
    customer_barangay: "Batong Malake",
    customer_zip: "4030",
    payment_amount: 2200,
    payment_status: "Unpaid",
    payment_method: "Cash",
    item_type: "Paper - A4 80gsm",
    quantity: 2000,
    layout_file: "brochure-trifold.png",
    target_date: todayIso(1),
    status: "In Production",
    cashier_id: null,
  },
  {
    order_id: "PF-2024-003",
    customer_name: "Creative Agency",
    customer_email: "creative@agency.com",
    customer_phone: "0921-567-8901",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "San Pedro",
    customer_barangay: "Landayan",
    customer_zip: "4023",
    payment_amount: 1800,
    payment_status: "Partial",
    payment_method: "E-Wallets",
    item_type: "Mug - White 11oz",
    quantity: 100,
    layout_file: "mug-design.png",
    target_date: todayIso(2),
    status: "Pending",
    cashier_id: null,
  },
  {
    order_id: "PF-2024-004",
    customer_name: "Local Bakery",
    customer_email: "orders@localbakery.ph",
    customer_phone: "0922-678-9012",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "Sta. Cruz",
    customer_barangay: "Pagsawitan",
    customer_zip: "4009",
    payment_amount: 1200,
    payment_status: "Paid",
    payment_method: "Cash",
    item_type: "Invitation - Matte",
    quantity: 50,
    layout_file: "invitation-layout.png",
    target_date: todayIso(-3),
    status: "Ready for Pickup",
    cashier_id: null,
  },
  {
    order_id: "PF-2024-005",
    customer_name: "Fashion Brand",
    customer_email: "purchase@fashionbrand.ph",
    customer_phone: "0923-789-0123",
    customer_region: "Region IV-A (CALABARZON)",
    customer_province: "Laguna",
    customer_city: "Biñan",
    customer_barangay: "Platero",
    customer_zip: "4024",
    payment_amount: 2100,
    payment_status: "Unpaid",
    payment_method: "Cash",
    item_type: "Screen Print - Shirt Blank Black",
    quantity: 30,
    layout_file: "shirt-design.png",
    target_date: todayIso(0),
    status: "In Production",
    cashier_id: null,
  },
];

const inventorySeeds = [
  { material_variant_id: "TARP-SMALL", item_type: "Tarpaulin - Small", category: "Tarpaulin", tag_uid: "04A3B2C1", sensor_id: "ESP32-01", current_stock: 12, threshold: 5, reorder_point: 6, forecasted_demand_next_7_days: 9, model: "Holt-Winters", last_updated: new Date().toISOString(), lastCheckoutAt: new Date().toISOString() },
  { material_variant_id: "TARP-MED", item_type: "Tarpaulin - Medium", category: "Tarpaulin", tag_uid: "04A3B2C2", sensor_id: "ESP32-01", current_stock: 2, threshold: 5, reorder_point: 4, forecasted_demand_next_7_days: 9, model: "Holt-Winters", last_updated: new Date().toISOString(), lastCheckoutAt: new Date().toISOString() },
  { material_variant_id: "TARP-LARGE", item_type: "Tarpaulin - Large", category: "Tarpaulin", tag_uid: "04A3B2C3", sensor_id: "ESP32-01", current_stock: 4, threshold: 5, reorder_point: 5, forecasted_demand_next_7_days: 7, model: "Holt-Winters", last_updated: new Date(Date.now() - 86400000 * 1).toISOString(), lastCheckoutAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { material_variant_id: "SHIRT-BLANK-WHITE-M", item_type: "Shirt Blank - White M", category: "Shirt", tag_uid: "04A3B2D1", sensor_id: "ESP32-01", current_stock: 45, threshold: 20, reorder_point: 22, forecasted_demand_next_7_days: 18, model: "Exponential Smoothing", last_updated: new Date().toISOString() },
  { material_variant_id: "SHIRT-BLANK-BLACK-L", item_type: "Shirt Blank - Black L", category: "Shirt", tag_uid: "04A3B2D2", sensor_id: "ESP32-01", current_stock: 8, threshold: 15, reorder_point: 14, forecasted_demand_next_7_days: 12, model: "Holt-Winters", last_updated: new Date().toISOString() },
  { material_variant_id: "MUG-WHITE-11OZ", item_type: "Mug - White 11oz", category: "Mug", tag_uid: "04A3B2E1", sensor_id: "ESP32-01", current_stock: 3, threshold: 10, reorder_point: 12, forecasted_demand_next_7_days: 15, model: "Holt-Winters", last_updated: new Date().toISOString() },
  { material_variant_id: "INK-BLACK", item_type: "Ink - Black", category: "Ink", tag_uid: "04A3B2F1", sensor_id: "ESP32-01", current_stock: 6, threshold: 8, reorder_point: 9, forecasted_demand_next_7_days: 8, model: "Exponential Smoothing", last_updated: new Date().toISOString() },
  { material_variant_id: "INK-CYAN", item_type: "Ink - Cyan", category: "Ink", tag_uid: "04A3B2F2", sensor_id: "ESP32-01", current_stock: 15, threshold: 8, reorder_point: 7, forecasted_demand_next_7_days: 5, model: "Holt-Winters", last_updated: new Date().toISOString() },
  { material_variant_id: "PAPER-A4-80GSM", item_type: "Paper - A4 80gsm", category: "Paper", tag_uid: "04A3B2G1", sensor_id: "ESP32-01", current_stock: 120, threshold: 50, reorder_point: 60, forecasted_demand_next_7_days: 45, model: "Holt-Winters", last_updated: new Date().toISOString() },
  { material_variant_id: "PAPER-GLOSSY-A3", item_type: "Paper - Glossy A3", category: "Paper", tag_uid: "04A3B2G2", sensor_id: "ESP32-01", current_stock: 18, threshold: 20, reorder_point: 25, forecasted_demand_next_7_days: 22, model: "Exponential Smoothing", last_updated: new Date().toISOString() },
];

// ---- write ---------------------------------------------------------------

let writes = 0;

// 1. Owner profile - written under the real Auth uid so AuthGate works.
await setDoc(doc(db, "users", ownerUid), {
  email: env.SEED_OWNER_EMAIL,
  name: "Jena Bersamina",
  role: "Owner",
  status: "active",
  address: {
    region: "Region IV-A (CALABARZON)",
    province: "Laguna",
    city: "Sta. Cruz",
    barangay: "Pagsawitan",
    zip: "4009",
  },
  created_at: Timestamp.now(),
  updated_at: Timestamp.now(),
  last_login_at: Timestamp.now(),
});
console.log(`[seed] users/${ownerUid}  (Owner profile)`);
writes++;

// Verify the role was actually committed. The next set of writes depend
// on isAdmin() / isOwner() in firestore.rules, and a too-fast follow-up
// write can race with the rules engine's snapshot read. Read it back, and
// if it's not "Owner" yet, refresh the Auth token (forces Firestore to
// re-evaluate rules against fresh user state) and try again.
async function confirmOwnerRole() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", ownerUid));
    if (snap.exists() && snap.data().role === "Owner") {
      console.log(`[seed] confirmed role = "Owner" (attempt ${attempt + 1})`);
      return;
    }
    // Force-refresh the ID token so any cached auth state clears, then wait
    // briefly for the rules engine to settle.
    if (auth.currentUser) {
      try { await auth.currentUser.getIdToken(true); } catch {}
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(
    "Owner role did not persist after writing users/{uid}. Aborting seed " +
      "to avoid partial data - re-run after fixing the role write.",
  );
}
await confirmOwnerRole();

// 2. Three employees (HR records, no Auth accounts).
const employees = [
  {
    employee_id: "EMP-0001",
    fname: "Maria",
    initial: "S",
    lname: "Santos",
    contact_number: "0917-111-2222",
    age: 28,
    gender: "Female",
    role: "POS_Cashier",
    status: "active",
    address: { region: "Region IV-A (CALABARZON)", province: "Laguna", city: "Sta. Cruz", barangay: "Pagsawitan", zip: "4009" },
  },
  {
    employee_id: "EMP-0002",
    fname: "Carlo",
    initial: "M",
    lname: "Reyes",
    contact_number: "0918-222-3333",
    age: 34,
    gender: "Male",
    role: "Production Staff",
    status: "active",
    address: { region: "Region IV-A (CALABARZON)", province: "Laguna", city: "Los Baños", barangay: "Batong Malake", zip: "4030" },
  },
  {
    employee_id: "EMP-0003",
    fname: "Liza",
    initial: "",
    lname: "Cruz",
    contact_number: "0919-333-4444",
    age: 25,
    gender: "Female",
    role: "POS_Cashier",
    status: "active",
    address: { region: "NCR", province: "Metro Manila", city: "Quezon City", barangay: "Diliman", zip: "1101" },
  },
];
for (const e of employees) {
  // Use the employee_id as the Firestore doc id so EMP-0001 maps 1:1 to /employees/EMP-0001.
  await setDoc(doc(db, "employees", e.employee_id), {
    ...e,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
  console.log(`[seed] employees/${e.employee_id}  (${e.fname} ${e.lname})`);
  writes++;
}

// 3. Orders - compute priority/ETA for "today" so the demo feels fresh.
for (const o of orderSeeds) {
  const priority = getPriority(o.target_date);
  const eta = getEta(o.target_date, priority);
  const docId = o.order_id;
  await setDoc(doc(db, "orders", docId), {
    customer_name: o.customer_name,
    customer_email: o.customer_email,
    customer_phone: o.customer_phone,
    customer_region: o.customer_region ?? null,
    customer_province: o.customer_province ?? null,
    customer_city: o.customer_city ?? null,
    customer_barangay: o.customer_barangay ?? null,
    customer_zip: o.customer_zip ?? null,
    item_type: o.item_type,
    quantity: o.quantity,
    layout_file: o.layout_file,
    target_date: Timestamp.fromDate(new Date(o.target_date + "T00:00:00Z")),
    payment_amount: o.payment_amount,
    payment_status: o.payment_status,
    payment_method: o.payment_method ?? null,
    status: o.status,
    priority,
    estimated_completion: Timestamp.fromDate(
      new Date(eta.estimated_completion + "T00:00:00Z"),
    ),
    based_on: eta.based_on,
    cashier_id: o.cashier_id ?? null,
    created_at: Timestamp.now(),
    ...(o.status === "In Production" ? { started_at: Timestamp.now() } : {}),
    ...(o.status === "Completed" ? { completed_at: Timestamp.now() } : {}),
  });
  console.log(`[seed] orders/${docId}  (${o.customer_name} - ${o.status})`);
  writes++;
}

// 4. Inventory - compute status/isStale from the same rules the web app uses.
for (const inv of inventorySeeds) {
  const status = getInvStatus(inv);
  const stale = isStale(inv.last_updated);
  await setDoc(doc(db, "inventory", inv.material_variant_id), {
    item_type: inv.item_type,
    category: inv.category,
    tag_uid: inv.tag_uid ?? null,
    sensor_id: inv.sensor_id ?? null,
    current_stock: inv.current_stock,
    threshold: inv.threshold,
    reorder_point: inv.reorder_point,
    forecasted_demand_next_7_days: inv.forecasted_demand_next_7_days,
    model: inv.model ?? null,
    status,
    isStale: stale,
    last_updated: Timestamp.fromDate(new Date(inv.last_updated)),
    lastCheckoutAt: inv.lastCheckoutAt
      ? Timestamp.fromDate(new Date(inv.lastCheckoutAt))
      : null,
  });
  console.log(`[seed] inventory/${inv.material_variant_id}  (${status})`);
  writes++;
}

// 5. RFID events - 5 sample check-outs. Best-effort: in production this
// collection is service-account-only (no client-side writes), so the
// signed-in Owner will be rejected by Firestore rules. We try, and if
// the rules reject, we log a warning and move on. The rest of the seed
// (orders, inventory, users, employees) is what the dashboard needs.
const rfidSeeds = [
  { material_variant_id: "TARP-MED", tag_uid: "04A3B2C2", sensor_id: "ESP32-01" },
  { material_variant_id: "TARP-MED", tag_uid: "04A3B2C2", sensor_id: "ESP32-01" },
  { material_variant_id: "TARP-SMALL", tag_uid: "04A3B2C1", sensor_id: "ESP32-01" },
  { material_variant_id: "INK-BLACK", tag_uid: "04A3B2F1", sensor_id: "ESP32-01" },
  { material_variant_id: "MUG-WHITE-11OZ", tag_uid: "04A3B2E1", sensor_id: "ESP32-01" },
];
const rfidCol = collection(db, "rfid_events");
let rfidWritten = 0;
for (const r of rfidSeeds) {
  const ref = doc(rfidCol);
  try {
    await setDoc(ref, {
      material_variant_id: r.material_variant_id,
      tag_uid: r.tag_uid,
      sensor_id: r.sensor_id,
      timestamp: Timestamp.now(),
    });
    console.log(`[seed] rfid_events/${ref.id}  (${r.material_variant_id})`);
    rfidWritten++;
  } catch (e) {
    // Most likely: Firestore rule rejected the write (the collection is
    // service-account-only in production). Warn once, then break the loop
    // so we don't spam the same error.
    const code = e?.code ?? "";
    if (code === "permission-denied" || /permission/i.test(String(e?.message ?? ""))) {
      console.warn(
        "[seed] rfid_events is service-account-only - skipping. " +
          "Run this script with a service account, or set up the ESP32 - " +
          "Cloud Function - Firestore flow, to populate RFID events.",
      );
      break;
    }
    throw e;
  }
}
writes += rfidWritten;

console.log(`\n[seed] Done. Wrote ${writes} docs.`);
process.exit(0);
