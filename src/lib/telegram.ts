/**
 * ส่งข้อความเข้ากลุ่ม Telegram (forum group) แยกตาม topic ของแต่ละ timeframe
 * ค่าจาก env — ห้าม hardcode token
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export type Timeframe = "M5" | "M15" | "M30" | "1H";

const TOPIC_THREAD: Record<Timeframe, string | undefined> = {
  M5: process.env.TELEGRAM_TOPIC_M5,
  M15: process.env.TELEGRAM_TOPIC_M15,
  M30: process.env.TELEGRAM_TOPIC_M30,
  "1H": process.env.TELEGRAM_TOPIC_1H,
};

export const telegramEnabled = Boolean(TOKEN && CHAT_ID);
export const TIMEFRAMES: Timeframe[] = ["M5", "M15", "M30", "1H"];

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface SignalInput {
  timeframe: Timeframe;
  side?: "BUY" | "SELL";
  symbol?: string;
  entry?: string | number;
  tp?: string | number;
  sl?: string | number;
  note?: string;
  text?: string;
}

/** จัดรูปข้อความสัญญาณให้อ่านง่าย (HTML) */
export function formatSignal(s: SignalInput): string {
  if (s.text) return s.text;
  const icon = s.side === "SELL" ? "🔴" : s.side === "BUY" ? "🟢" : "🔔";
  const head = `${icon} <b>${escapeHtml(s.side ?? "SIGNAL")} ${escapeHtml(s.symbol ?? "XAUUSD")}</b> · ${s.timeframe}`;
  const lines = [head];
  if (s.entry !== undefined) lines.push(`Entry: <b>${escapeHtml(String(s.entry))}</b>`);
  if (s.tp !== undefined) lines.push(`TP: <b>${escapeHtml(String(s.tp))}</b>`);
  if (s.sl !== undefined) lines.push(`SL: <b>${escapeHtml(String(s.sl))}</b>`);
  if (s.note) lines.push(`\n${escapeHtml(s.note)}`);
  return lines.join("\n");
}

/** ส่งข้อความเข้า topic ตาม timeframe */
export async function sendToTopic(timeframe: Timeframe, text: string) {
  if (!TOKEN || !CHAT_ID) throw new Error("ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
  const thread = TOPIC_THREAD[timeframe];

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_thread_id: thread ? Number(thread) : undefined,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${data.description ?? "unknown"}`);
  return data;
}

/** แจ้งเตือนแอดมิน (ข้อความธรรมดา) — ตั้ง TELEGRAM_ADMIN_CHAT_ID */
export async function sendAdminAlert(text: string) {
  const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const adminTopic = process.env.TELEGRAM_ADMIN_TOPIC_ID;
  if (!TOKEN || !adminChat) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChat,
        message_thread_id: adminTopic ? Number(adminTopic) : undefined,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch {
    /* best-effort */
  }
}
