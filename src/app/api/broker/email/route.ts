import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { z } from "zod";
import { parseBrokerEmail, recordEmailEvent } from "@/lib/broker-events";
import { sendAdminAlert } from "@/lib/telegram";
import { BROKER_EVENT_TYPE as T } from "@/config/status";

export const dynamic = "force-dynamic";

/**
 * รับอีเมลแจ้งเตือนจากโบรก — บอทอ่านเมล (scripts/broker/mailbot.py) ส่งมาที่นี่
 *
 * Wisdom ไม่มี API ให้เชื่อม ช่องทางเดียวที่ได้คืออีเมลที่พาร์ตเนอร์ส่งต่อมา
 * ที่นี่แค่ "รับและเก็บ" ไม่อนุมัติสิทธิ์ให้ใครเอง — อีเมลปลอมง่ายเกินกว่าจะเชื่อโดยไม่มีคนดู
 * ใช้เป็นหลักฐานประกอบให้พาร์ตเนอร์/แอดมินกดอนุมัติเร็วขึ้นเท่านั้น
 *
 * ต้องตั้ง BROKER_MAIL_SECRET บน Vercel ให้ตรงกับที่บอทใช้ — ไม่ตั้ง = ปิดตาย
 */

const schema = z.object({
  secret: z.string().max(256),
  subject: z.string().max(998).default(""),
  from: z.string().max(320).default(""),
  body: z.string().max(200_000).default(""),
  /** Message-ID ของอีเมล — กันบันทึกซ้ำเมื่อบอทอ่านกล่องเดิมอีกรอบ */
  messageId: z.string().max(998).nullish(),
  receivedAt: z.string().datetime().nullish(),
});

function secretMatches(given: string): boolean {
  const expected = process.env.BROKER_MAIL_SECRET;
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!process.env.BROKER_MAIL_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  if (!secretMatches(parsed.data.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { subject, from, body: text, messageId, receivedAt } = parsed.data;
  const when = receivedAt ? new Date(receivedAt) : new Date();
  const email = parseBrokerEmail({ subject, body: text, receivedAt: when });

  const result = await recordEmailEvent({
    parsed: email,
    externalId: messageId?.trim() || null,
    // เก็บหัวข้อกับผู้ส่งไว้ด้วย — ตอนอ่านไม่ออกคนต้องเห็นว่าอีเมลหน้าตายังไง
    rawText: `From: ${from}\nSubject: ${subject}\n\n${text}`,
  });

  // อ่านไม่ออก หรือฝาก/ถอนแต่ไม่เจอเลขบัญชี = ตัวอ่านยังไม่รู้จักรูปแบบนี้ ต้องมีคนไปดูแล้วปรับ
  // สมัครแล้วไม่มีเลขบัญชีเป็นเรื่องปกติ — Wisdom แจ้ง "ผู้ใช้ใหม่ลงทะเบียน" ก่อนลูกค้าเปิดบัญชีเทรด
  // ถ้าแจ้งเตือนด้วย กลุ่มแอดมินจะเด้งทุกครั้งที่มีคนสมัคร (เจอจริงวันแรกที่เปิดบอท 30 ก.ย. 2569)
  const unreadable = email.type === T.UNKNOWN || (email.type !== T.SIGNUP && !email.tradingAccount);
  if (result.created && unreadable) {
    try {
      await sendAdminAlert(
        `📧 อีเมลโบรกที่อ่านไม่ครบ\nหัวข้อ: ${subject || "(ไม่มี)"}\n` +
          `ชนิด: ${email.type}${email.tradingAccount ? "" : " · ไม่เจอเลขบัญชี"}\n` +
          `ดูและบันทึกเองได้ที่ /admin/wisdom`
      );
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    type: email.type,
    tradingAccount: email.tradingAccount,
  });
}
