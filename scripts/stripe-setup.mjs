/**
 * สร้าง Product + Recurring Prices (THB) บน Stripe อัตโนมัติ
 * ใช้: ตั้ง STRIPE_SECRET_KEY (test) ใน .env แล้วรัน  ->  node scripts/stripe-setup.mjs
 * รันซ้ำได้ (idempotent ด้วย lookup_key) แล้วก๊อป Price ID ไปวางใน .env
 */
import Stripe from "stripe";
import { readFileSync } from "node:fs";

// โหลด STRIPE_SECRET_KEY จาก .env แบบง่าย ๆ (ไม่พึ่ง dependency)
function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌ ยังไม่มี STRIPE_SECRET_KEY ใน .env — ใส่คีย์ test (sk_test_...) ก่อน");
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.warn("⚠️  คีย์นี้ไม่ใช่ test key — โปรดใช้ sk_test_... ตอนทดสอบ");
}

const stripe = new Stripe(key);

const PRODUCT_NAME = "QVX Membership";
const plans = [
  { code: "MONTH", label: "รายเดือน", amount: 129000, interval: "month", count: 1, env: "STRIPE_PRICE_MONTH" },
  { code: "Q3", label: "ราย 3 เดือน", amount: 387000, interval: "month", count: 3, env: "STRIPE_PRICE_Q3" },
  { code: "H6", label: "ราย 6 เดือน", amount: 774000, interval: "month", count: 6, env: "STRIPE_PRICE_H6" },
  { code: "YEAR", label: "รายปี", amount: 1548000, interval: "year", count: 1, env: "STRIPE_PRICE_YEAR" },
];

let productId = null;
async function getProduct() {
  if (productId) return productId;
  const existing = await stripe.products.search({ query: `name:'${PRODUCT_NAME}'` }).catch(() => null);
  if (existing?.data?.[0]) productId = existing.data[0].id;
  else productId = (await stripe.products.create({ name: PRODUCT_NAME })).id;
  return productId;
}

const results = [];
for (const p of plans) {
  const lookup = `qvx_${p.code.toLowerCase()}`;
  const found = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 });
  let price = found.data[0];
  if (!price) {
    price = await stripe.prices.create({
      product: await getProduct(),
      currency: "thb",
      unit_amount: p.amount,
      lookup_key: lookup,
      nickname: `QVX ${p.label}`,
      recurring: { interval: p.interval, interval_count: p.count },
    });
    console.log(`✅ สร้าง ${p.code}: ${price.id}`);
  } else {
    console.log(`↺ มีอยู่แล้ว ${p.code}: ${price.id}`);
  }
  results.push([p.env, price.id]);
}

console.log("\n===== ก๊อปบรรทัดนี้ไปวางใน .env =====\n");
for (const [env, id] of results) console.log(`${env}="${id}"`);
console.log("\n(อย่าลืมตั้ง STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET และ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ด้วย)");
