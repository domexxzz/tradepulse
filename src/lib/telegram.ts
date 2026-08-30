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
  /** TP ชั้นแรก */
  tp?: string | number;
  /** TP ชั้นที่สอง (อินดิเคเตอร์ส่งมาเป็น tp2) */
  tp2?: string | number;
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
  if (s.tp !== undefined) lines.push(`${s.tp2 !== undefined ? "TP1" : "TP"}: <b>${escapeHtml(String(s.tp))}</b>`);
  if (s.tp2 !== undefined) lines.push(`TP2: <b>${escapeHtml(String(s.tp2))}</b>`);
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
    // ปลายทางค้างไม่ตอบ ต้องตัดทิ้ง ไม่งั้นฟังก์ชันค้างจนหมดเวลา
    signal: AbortSignal.timeout(10_000),
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

export interface AdminAlertResult {
  sent: boolean;
  /** เหตุผลที่ส่งไม่ได้ — ใช้ตอนดีบัก/ยิงทดสอบ */
  reason?: string;
}

/**
 * แจ้งเตือนแอดมิน (ข้อความธรรมดา) — ตั้ง TELEGRAM_ADMIN_CHAT_ID
 *
 * คืนสถานะจริงเสมอ (ไม่กลืน error เงียบ ๆ): ตัวเรียกแบบ fire-and-forget
 * ไม่สนค่าที่คืนก็ได้ แต่ endpoint ทดสอบจะได้บอกได้ว่าส่งสำเร็จหรือไม่เพราะอะไร
 * เคยเจอมาแล้วว่าไม่ได้ตั้ง TELEGRAM_ADMIN_CHAT_ID แล้วเงียบไปเฉย ๆ
 * กว่าจะรู้ก็ตอนบริดจ์ล่มจริงแล้วไม่มีใครได้รับแจ้ง
 */
export async function sendAdminAlert(text: string): Promise<AdminAlertResult> {
  const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const adminTopic = process.env.TELEGRAM_ADMIN_TOPIC_ID;
  if (!TOKEN) return { sent: false, reason: "ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN" };
  if (!adminChat) return { sent: false, reason: "ยังไม่ได้ตั้ง TELEGRAM_ADMIN_CHAT_ID (ปลายทางแจ้งเตือน)" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      // ปลายทางค้างไม่ตอบ ต้องตัดทิ้ง ไม่งั้นฟังก์ชันค้างจนหมดเวลา
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChat,
        message_thread_id: adminTopic ? Number(adminTopic) : undefined,
        text,
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!data.ok) {
      const reason = data.description ?? `HTTP ${res.status}`;
      console.error("sendAdminAlert: telegram ปฏิเสธ:", reason);
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    console.error("sendAdminAlert: ส่งไม่สำเร็จ:", reason);
    return { sent: false, reason };
  }
}

/* ------------------------------------------------------------------ */
/* จัดการสมาชิกในกลุ่มอัตโนมัติ                                          */
/* ------------------------------------------------------------------ */

/**
 * ทำไมต้องใช้ลิงก์ส่วนตัวแทนลิงก์กลุ่มลิงก์เดียว
 *
 * ลิงก์เดียวที่ส่งให้ทุกคนถูกส่งต่อได้ไม่จำกัด — คนที่ไม่ได้จ่ายเงินก็เข้าได้
 * และเราไม่มีทางรู้ว่าใครในกลุ่มคือสมาชิกคนไหน จึงเตะออกตอนหมดอายุไม่ได้
 *
 * วิธีนี้: สร้างลิงก์ต่อสมาชิกหนึ่งใบ ตั้งให้ต้อง "ขออนุมัติ" ก่อนเข้า
 * พอมีคนกด Telegram จะยิง chat_join_request มาที่ webhook ของเรา
 * พร้อมบอกว่าใช้ลิงก์ใบไหน → เราเช็คว่าเจ้าของลิงก์ยังจ่ายเงินอยู่ไหมแล้วค่อยอนุมัติ
 * ได้ Telegram user id ติดมาด้วย ทำให้ตอนหมดอายุนำออกได้จริง
 */
export const telegramGroupManaged = Boolean(TOKEN && CHAT_ID);

/** ลิงก์เชิญมีอายุกี่วันก่อนหมดอายุไปเอง */
const INVITE_DAYS = 7;

async function callApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!TOKEN) throw new Error("ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN");

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    // ปลายทางค้างไม่ตอบ ต้องตัดทิ้ง ไม่งั้นฟังก์ชันค้างจนหมดเวลา
    signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? "unknown"}`);
  return data.result as T;
}

/**
 * สร้างลิงก์เชิญเฉพาะคน — ตั้งชื่อลิงก์เป็นรหัสคิว เพื่อให้ webhook รู้ว่าเป็นของใคร
 * (ชื่อลิงก์ยาวได้ 32 ตัวอักษร ซึ่งพอดีกับ cuid ที่เราใช้เป็น id)
 */
export async function createMemberInviteLink(grantId: string): Promise<string> {
  const result = await callApi<{ invite_link: string }>("createChatInviteLink", {
    chat_id: CHAT_ID,
    name: grantId.slice(0, 32),
    expire_date: Math.floor(Date.now() / 1000) + INVITE_DAYS * 24 * 60 * 60,
    // ต้องขออนุมัติก่อนเข้า เพื่อให้เราตรวจสิทธิ์ได้ทันก่อนคนเข้ากลุ่มจริง
    creates_join_request: true,
  });
  return result.invite_link;
}

/** ปิดลิงก์ไม่ให้ใช้ซ้ำ (เรียกหลังอนุมัติคนแรกแล้ว) */
export async function revokeInviteLink(inviteLink: string): Promise<void> {
  await callApi("revokeChatInviteLink", { chat_id: CHAT_ID, invite_link: inviteLink });
}

export async function approveJoinRequest(telegramUserId: string | number): Promise<void> {
  await callApi("approveChatJoinRequest", { chat_id: CHAT_ID, user_id: telegramUserId });
}

export async function declineJoinRequest(telegramUserId: string | number): Promise<void> {
  await callApi("declineChatJoinRequest", { chat_id: CHAT_ID, user_id: telegramUserId });
}

/**
 * นำสมาชิกออกจากกลุ่มเมื่อหมดอายุ
 *
 * Telegram ไม่มีคำสั่ง "เตะ" ตรง ๆ ต้อง ban แล้ว unban ทันที
 * ถ้า ban ค้างไว้ สมาชิกที่กลับมาต่ออายุจะเข้ากลุ่มไม่ได้อีกเลย
 */
export async function removeGroupMember(telegramUserId: string | number): Promise<void> {
  await callApi("banChatMember", { chat_id: CHAT_ID, user_id: telegramUserId });
  await callApi("unbanChatMember", { chat_id: CHAT_ID, user_id: telegramUserId, only_if_banned: true });
}

/** ยังอยู่ในกลุ่มไหม — ใช้ตอนต่ออายุ จะได้ไม่ส่งลิงก์เชิญให้คนที่อยู่ในกลุ่มอยู่แล้ว */
export async function isGroupMember(telegramUserId: string | number): Promise<boolean> {
  try {
    const r = await callApi<{ status: string }>("getChatMember", {
      chat_id: CHAT_ID,
      user_id: telegramUserId,
    });
    return ["creator", "administrator", "member", "restricted"].includes(r.status);
  } catch {
    // ถามไม่ได้ก็ถือว่าไม่อยู่ แล้วส่งลิงก์ให้ใหม่ — เสียหายน้อยกว่าปล่อยให้เข้ากลุ่มไม่ได้
    return false;
  }
}
