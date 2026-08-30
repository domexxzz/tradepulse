/**
 * ตั้ง/ลบ/ดู webhook ของบอท Telegram
 *
 * ต้องตั้ง webhook ถึงจะรับ "คำขอเข้ากลุ่ม" ได้ ซึ่งเป็นหัวใจของการเชิญอัตโนมัติ
 * (ไม่มี webhook = ลิงก์เชิญส่วนตัวจะไม่มีใครอนุมัติ สมาชิกค้างอยู่หน้ารออนุมัติ)
 *
 * วิธีใช้:
 *   node scripts/telegram-webhook.mjs set      # ตั้ง webhook ไปที่ NEXT_PUBLIC_SITE_URL
 *   node scripts/telegram-webhook.mjs info     # ดูสถานะปัจจุบัน
 *   node scripts/telegram-webhook.mjs delete   # ยกเลิก (กลับไปโหมด polling ได้)
 *
 * ⚠️ บอทหนึ่งตัวมี webhook ได้ทางเดียว และใช้พร้อม polling ไม่ได้
 *    ถ้าโทเคนนี้ถูกใช้กับบอท Python ที่รัน polling อยู่ ให้แยกโทเคนคนละตัว
 */
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const action = process.argv[2] ?? "info";

if (!TOKEN) {
  console.error("❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

if (action === "set") {
  if (!SITE.startsWith("https://")) {
    console.error("❌ NEXT_PUBLIC_SITE_URL ต้องเป็น https จริง (Telegram ไม่ยิงเข้า localhost)");
    process.exit(1);
  }
  if (!SECRET) {
    console.error("❌ ยังไม่ได้ตั้ง TELEGRAM_WEBHOOK_SECRET — ห้ามเปิด webhook โดยไม่มีรหัสยืนยัน");
    process.exit(1);
  }

  const url = `${SITE}/api/telegram/webhook`;
  const r = await call("setWebhook", {
    url,
    secret_token: SECRET,
    // ขอเฉพาะเหตุการณ์ที่ใช้จริง — ไม่ต้องรับข้อความทุกข้อความในกลุ่ม
    //
    // "message" จำเป็นสำหรับ /start ในแชทส่วนตัว ซึ่งเป็นทางเดียวที่สมาชิก
    // จะให้สิทธิ์บอททัก DM ได้ (Telegram ห้ามบอททักคนก่อน) ถ้าไม่มีตัวนี้
    // จะส่งภาพหลักฐานสิทธิ์หรือแจ้งเตือนใกล้หมดอายุหาสมาชิกไม่ได้เลย
    // webhook กรองเองอยู่แล้วว่ารับเฉพาะ /start จากแชทส่วนตัว
    allowed_updates: ["chat_join_request", "message"],
    drop_pending_updates: true,
  });
  console.log(r.ok ? `✅ ตั้ง webhook แล้ว: ${url}` : `❌ ล้มเหลว: ${r.description}`);
} else if (action === "delete") {
  const r = await call("deleteWebhook", { drop_pending_updates: false });
  console.log(r.ok ? "✅ ยกเลิก webhook แล้ว" : `❌ ล้มเหลว: ${r.description}`);
} else {
  const r = await call("getWebhookInfo");
  if (!r.ok) {
    console.error(`❌ ${r.description}`);
    process.exit(1);
  }
  const i = r.result;
  console.log("URL:", i.url || "(ยังไม่ได้ตั้ง)");
  console.log("รับเหตุการณ์:", (i.allowed_updates ?? ["ทั้งหมด"]).join(", "));
  console.log("คิวค้าง:", i.pending_update_count);
  if (i.last_error_message) {
    console.log("ข้อผิดพลาดล่าสุด:", i.last_error_message, `(${new Date(i.last_error_date * 1000).toLocaleString("th-TH")})`);
  }
}
