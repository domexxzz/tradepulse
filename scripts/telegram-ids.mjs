/**
 * หา chat_id ของกลุ่ม + message_thread_id ของแต่ละ topic
 * วิธีใช้:
 *   1. เพิ่มบอทเข้ากลุ่ม + ตั้งเป็นแอดมิน (หรือปิด privacy mode ผ่าน BotFather)
 *   2. พิมพ์ข้อความอะไรก็ได้ใน "แต่ละ topic" (M5, M15, M30, 1H) อย่างละ 1 ครั้ง
 *   3. ตั้ง TELEGRAM_BOT_TOKEN ใน .env แล้วรัน:  node scripts/telegram-ids.mjs
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
if (!TOKEN) {
  console.error("❌ ยังไม่มี TELEGRAM_BOT_TOKEN ใน .env");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
const data = await res.json();
if (!data.ok) {
  console.error("❌ getUpdates ล้มเหลว:", data.description);
  process.exit(1);
}

const chats = new Map();
const topics = new Map();
for (const u of data.result) {
  const msg = u.message ?? u.channel_post;
  if (!msg?.chat) continue;
  chats.set(msg.chat.id, msg.chat.title ?? msg.chat.type);
  if (msg.message_thread_id) {
    const name = msg.forum_topic_created?.name ?? msg.reply_to_message?.forum_topic_created?.name ?? "(topic)";
    topics.set(msg.message_thread_id, name);
  }
}

if (chats.size === 0) {
  console.log("⚠️  ยังไม่เห็น update — เพิ่มบอทเข้ากลุ่ม+ตั้งแอดมิน แล้วพิมพ์ข้อความในแต่ละ topic ก่อน");
  process.exit(0);
}

console.log("\n=== chat_id ของกลุ่ม ===");
for (const [id, title] of chats) console.log(`TELEGRAM_CHAT_ID="${id}"   # ${title}`);

console.log("\n=== topic thread id (เอาไปจับคู่กับ timeframe เอง) ===");
for (const [tid, name] of topics) console.log(`thread_id=${tid}   # topic: ${name}`);

console.log(`
ตัวอย่างที่จะวางใน .env:
TELEGRAM_TOPIC_M5="<thread ของ topic M5>"
TELEGRAM_TOPIC_M15="<thread ของ topic M15>"
TELEGRAM_TOPIC_M30="<thread ของ topic M30>"
TELEGRAM_TOPIC_1H="<thread ของ topic 1H>"
`);
