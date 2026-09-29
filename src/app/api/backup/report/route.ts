import { NextResponse } from "next/server";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * เครื่องสำรองข้อมูลแจ้งผลเข้ามาทางนี้ แล้วเว็บส่งต่อเข้า Telegram ห้อง Admin QVX
 *
 * ทำไมไม่ให้เครื่องสำรองยิง Telegram เอง (ของเดิมทำแบบนั้น)
 *   ต้องเก็บ bot token ไว้บนเครื่องนั้นอีกชุด ซึ่งเป็นภาระและเป็นความเสี่ยงเพิ่มอีกจุด
 *   และบอทตัวที่เก็บไว้ (@BMTradingViewIndicator_Bot) ไม่ได้อยู่ในห้องไหนเลย
 *   แจ้งเตือนจึงไม่เคยถึงใครมาตลอด ทั้งที่สคริปต์รายงานว่า "แจ้งเตือนแล้ว"
 *   ตรวจแล้วเมื่อ 29 ก.ย. 69 — getChat ทั้งห้อง QVX SIGNAL และ Admin QVX ตอบ 400
 *
 *   ทางนี้ใช้บอทตัวเดียวกับที่เว็บใช้อยู่ ซึ่งอยู่ในห้อง Admin QVX จริง
 *   เครื่องสำรองถือแค่ความลับของ endpoint นี้ ไม่ต้องถือ token ของบอทอีกต่อไป
 *
 * ต้องตั้ง env BACKUP_ALERT_SECRET — ไม่ตั้ง = ปิดตาย (ปิดดีกว่าเปิดโล่ง
 * เพราะใครก็ยิงข้อความปลอมเข้าห้องแอดมินได้)
 */
function authorized(req: Request): boolean {
  const secret = process.env.BACKUP_ALERT_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** ตัดข้อความยาว ๆ ทิ้ง — Telegram รับ 4096 ตัว และ log ยาวไม่ได้ช่วยให้อ่านง่ายขึ้น */
const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { ok?: boolean; host?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const host = clamp(String(body.host ?? "ไม่ระบุ"), 60);
  const message = clamp(String(body.message ?? ""), 1200);

  // สำเร็จทุกคืนแล้วเด้งทุกคืนคือ noise ที่ทำให้คนเลิกอ่าน — แจ้งเฉพาะตอนพัง
  // แต่ยังรับ ok:true ไว้เพื่อให้ทดสอบท่อได้ว่าถึงห้องจริงหรือยัง
  const text = body.ok
    ? `🟢 ทดสอบท่อแจ้งเตือนสำรองข้อมูล\nเครื่อง: ${host}${message ? `\n${message}` : ""}`
    : `🔴 สำรองฐานข้อมูล QVX ล้มเหลว\n${message}\nเครื่อง: ${host}`;

  const res = await sendAdminAlert(text);
  return NextResponse.json({ ok: res.sent, reason: res.reason }, { status: res.sent ? 200 : 502 });
}
