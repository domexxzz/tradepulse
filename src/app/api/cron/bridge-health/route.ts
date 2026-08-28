import { NextResponse } from "next/server";
import { checkBridgeHealth } from "@/lib/tradingview";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * เฝ้าดูบริดจ์ TradingView — ถ้าตัวหลัก (server-254) ล่ม แจ้งเตือนแอดมินทาง Telegram
 *
 * ทำไมต้องรันบนคลาวด์: บริดจ์อยู่เครื่องที่บ้าน ถ้าเฝ้าจากเครื่องที่บ้านด้วยกัน
 * เครื่องดับก็ไม่มีใครแจ้ง — cron ของ Vercel รันในคลาวด์จึงเห็นทุกกรณี
 *
 * ตั้งเวลาใน vercel.json (ทุก 5 นาที) และกันด้วย CRON_SECRET เหมือน cron อื่น
 * เว็บมี fallback อัตโนมัติอยู่แล้ว (ตัวหลักล่ม → ยิงคอมเบสให้เอง ถ้าคอมเบสเปิด)
 * cron นี้แค่ "บอกให้รู้" + เตือนว่าถ้าจะให้ fallback ทำงานต้องเปิดคอมเบสไว้
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

  const health = await checkBridgeHealth();
  const primaryUp = health.primary?.up ?? false;
  const backupConfigured = health.backup !== null;
  const backupUp = health.backup?.up ?? false;

  // ตัวหลักปกติ = ไม่ต้องทำอะไร (ไม่กวนแอดมิน)
  if (primaryUp) {
    return NextResponse.json({ ok: true, primaryUp: true, backupUp, alerted: false });
  }

  // ตัวหลักล่ม — เตือนแอดมิน พร้อมบอกทางเลือกเปิดคอมเบสมา backup
  const lines = [
    "🔴 บริดจ์ TradingView ตัวหลัก (server-254) ติดต่อไม่ได้",
    "",
    "ผลกระทบ: ถ้ามีลูกค้าซื้อตอนนี้ บอทจะเพิ่มสิทธิ์ให้ไม่ได้",
    "",
    backupConfigured
      ? backupUp
        ? "✅ คอมเบส (ตัวสำรอง) เปิดอยู่ — เว็บสลับไปใช้ให้อัตโนมัติแล้ว ระบบยังทำงานต่อได้"
        : "⚠️ คอมเบส (ตัวสำรอง) ก็ปิดอยู่ — ตอนนี้ไม่มีบริดจ์ทำงานเลย"
      : "ℹ️ ยังไม่ได้ตั้งบริดจ์สำรอง",
  ];

  if (!primaryUp && !backupUp) {
    lines.push(
      "",
      "ต้องทำ: เปิดคอมเบสมา backup",
      "1) ปลุกคอมเบส แล้วเปิดบริดจ์ (ดู COMBASE_RUNBOOK / combase.sh)",
      "2) หรือกู้ server-254 ให้กลับมา",
      "",
      "เว็บจะสลับไปคอมเบสเองทันทีที่มันเปิด — ไม่ต้องแก้ค่าอะไร"
    );
  }

  try {
    await sendAdminAlert(lines.join("\n"));
  } catch (e) {
    console.error("bridge-health alert failed:", e);
  }

  return NextResponse.json({
    ok: true,
    primaryUp: false,
    backupConfigured,
    backupUp,
    alerted: true,
  });
}

export const GET = run;
export const POST = run;
