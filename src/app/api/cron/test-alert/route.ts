import { NextResponse } from "next/server";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * ยิงข้อความทดสอบเข้าช่องแจ้งเตือนแอดมิน — ไว้ยืนยันว่าปลายทาง Telegram ตั้งถูก
 *
 * ต่างจาก cron ตัวอื่นตรงที่ "ตั้งใจให้ส่งทุกครั้ง" ไม่มีเงื่อนไข
 * ใช้พิสูจน์ทั้งตอนยังไม่ได้ตั้งปลายทาง (จะได้ reason กลับมาชัด ๆ)
 * และตอนตั้งเสร็จแล้ว (ข้อความจะเด้งเข้า Telegram จริง)
 *
 * กันด้วย CRON_SECRET เหมือน cron ตัวอื่น — ไม่ตั้ง secret = ปิดตาย
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stamp = new Date().toISOString();
  const result = await sendAdminAlert(
    [
      "🔔 ทดสอบระบบแจ้งเตือนแอดมิน",
      "",
      "ถ้าเห็นข้อความนี้ แปลว่าการแจ้งเตือน (บริดจ์ล่ม / สลิปใหม่ / งานค้าง) พร้อมส่งถึงคุณแล้ว",
      `เวลา (UTC): ${stamp}`,
    ].join("\n")
  );

  // ok=false พร้อม reason เมื่อยังไม่ได้ตั้งปลายทาง — จะได้รู้สาเหตุทันที
  return NextResponse.json({ ok: result.sent, ...result });
}

export const GET = run;
export const POST = run;
