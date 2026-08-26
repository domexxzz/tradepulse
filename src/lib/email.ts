/**
 * ส่งอีเมลผ่าน Resend (เรียก REST API ตรง ไม่เพิ่ม dependency)
 *
 * ทุกฟังก์ชันในไฟล์นี้ "ห้าม throw" — อีเมลเป็นงานเสริมเสมอ
 * ถ้าผู้ให้บริการล่มหรือยังไม่ได้ตั้งคีย์ การอนุมัติออเดอร์/สมัครสมาชิกต้องเดินต่อได้ปกติ
 */
const API_KEY = process.env.RESEND_API_KEY;

/** ผู้ส่ง เช่น "QVX <no-reply@yourdomain.com>" — โดเมนต้อง verify กับ Resend ก่อน */
const FROM = process.env.EMAIL_FROM;

/** ให้ลูกค้ากด reply แล้วถึงทีมงานจริง (ไม่ตั้งก็ได้) */
const REPLY_TO = process.env.EMAIL_REPLY_TO;

export const emailEnabled = Boolean(API_KEY && FROM);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** ข้อความสำรองสำหรับอีเมลที่ปิดการแสดง HTML */
  text?: string;
  /** header เพิ่มเติม เช่น List-Unsubscribe ของอีเมลข่าวสาร */
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** ส่งอีเมลหนึ่งฉบับ — คืน skipped=true เมื่อยังไม่ได้ตั้งค่าระบบอีเมล */
export async function sendEmail({ to, subject, html, text, headers }: SendEmailInput): Promise<SendEmailResult> {
  if (!emailEnabled) return { ok: false, skipped: true };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
        ...(headers ? { headers } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("resend failed:", res.status, detail.slice(0, 300));
      return { ok: false, error: `resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("resend error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
