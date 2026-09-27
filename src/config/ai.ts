/**
 * QVX AI — ค่าคงที่ที่ปรับได้โดยไม่ต้องแตะตรรกะ
 */

/** จำนวนคำถามที่ตอบสำเร็จต่อเดือนปฏิทิน (เวลาไทย) — เท่ากับของเดิมบน Supabase */
export const AI_MONTHLY_LIMIT = 300;

/** ความยาวคำถามสูงสุด (ตัวอักษร) */
export const AI_MAX_MESSAGE_CHARS = 4000;

/** ส่งบทสนทนาย้อนหลังให้โมเดลกี่ข้อความ — มากกว่านี้เปลือง token โดยไม่ได้คำตอบดีขึ้น */
export const AI_HISTORY_MESSAGES = 12;

/** ข้อมูลตลาดเก่ากว่านี้ถือว่าไม่ใช่ "ตอนนี้" แล้ว ห้ามส่งให้โมเดลวิเคราะห์เป็นราคาสด */
export const MARKET_FRESH_MS = 15 * 60_000;

/** คำขอที่จองโควตาแล้วค้างเกินนี้ = ตายกลางทาง ไม่นับเป็นโควตา */
export const AI_PENDING_STALE_MS = 5 * 60_000;

/** กันกดรัว — ต่อคน ต่อนาที */
export const AI_RATE_LIMIT_PER_MINUTE = 8;

/** ใช้โมเดลตัวไหน — ค่าเริ่มต้นตามที่น็อตทดสอบบน production แล้ว เปลี่ยนได้ด้วย OPENAI_MODEL */
export const AI_DEFAULT_MODEL = "gpt-6-luna";

export const AI_USAGE_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  ERROR: "ERROR",
} as const;

/** รหัสผิดพลาดที่หน้าแชตรู้จัก — ข้อความภาษาไทยอยู่ที่ AI_ERROR_MESSAGES */
export type AiErrorCode =
  | "AI_ACCESS_LOCKED"
  | "AI_QUOTA_EXHAUSTED"
  | "AI_RATE_LIMITED"
  | "INVALID_MESSAGE"
  | "CONVERSATION_NOT_FOUND"
  | "AI_NOT_CONFIGURED"
  | "AI_TEMPORARILY_UNAVAILABLE";

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_ACCESS_LOCKED: "สิทธิ์ QVX AI ใช้ได้เฉพาะสมาชิกที่สิทธิ์อินดิเคเตอร์ยังไม่หมดอายุ",
  AI_QUOTA_EXHAUSTED: `ใช้ครบ ${AI_MONTHLY_LIMIT} คำถามของเดือนนี้แล้ว โควตาจะเริ่มใหม่วันที่ 1 ของเดือนหน้า`,
  AI_RATE_LIMITED: "ถามถี่เกินไป รอสักครู่แล้วลองใหม่",
  INVALID_MESSAGE: `พิมพ์คำถามก่อนส่ง (ไม่เกิน ${AI_MAX_MESSAGE_CHARS.toLocaleString()} ตัวอักษร)`,
  CONVERSATION_NOT_FOUND: "ไม่พบบทสนทนานี้ ลองเริ่มแชตใหม่",
  AI_NOT_CONFIGURED: "QVX AI ยังไม่เปิดให้บริการ",
  AI_TEMPORARILY_UNAVAILABLE: "QVX AI ตอบไม่ได้ชั่วคราว ลองอีกครั้ง — คำถามนี้ไม่ถูกนับโควตา",
};
