import { NextResponse } from "next/server";
import { checkBridgeHealth } from "@/lib/tradingview";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * เฝ้าดูบริดจ์ TradingView — ถ้าตัวหลักล่ม แจ้งเตือนแอดมินทาง Telegram
 *
 * ทำไมต้องรันบนคลาวด์: บริดจ์อยู่เครื่องที่บ้าน ถ้าเฝ้าจากเครื่องที่บ้านด้วยกัน
 * เครื่องดับก็ไม่มีใครแจ้ง — GitHub Actions เรียก endpoint นี้จากคลาวด์จึงเห็นทุกกรณี
 *
 * เรียกโดย .github/workflows/bridge-health.yml (ตั้งทุก 10 นาที แต่ GitHub รันจริงห่างกันหลายชั่วโมง)
 * กันด้วย CRON_SECRET เหมือน cron อื่น
 * เว็บมี fallback อัตโนมัติอยู่แล้ว (ตัวหลักล่ม → ยิงตัวสำรองให้เอง ถ้าตัวสำรองเปิด)
 * cron นี้แค่ "บอกให้รู้" + บอกว่าต้องไปกู้เครื่องไหน
 */

/**
 * ชื่อเครื่องที่แอดมินเห็นในข้อความเตือน — ย้ายเครื่องบอทเมื่อไหร่ แก้ตรงนี้ด้วย
 * (ตรงกับ docs/HANDOFF.md หัวข้อ 5.1 · ตัวหลัก = TV_BOT_URL · ตัวสำรอง = TV_BOT_URL_BACKUP)
 */
const PRIMARY_NAME = "คอมเฟิร์ส";
const BACKUP_NAME = "คอมเบส";

/** แสดงแค่ชื่อโฮสต์ ให้แอดมินรู้ว่าเว็บยิงไปที่ไหนจริง (ค่า env ผิดเครื่องจะเห็นทันที) */
function hostOf(url: string | undefined): string {
  if (!url) return "?";
  try {
    return new URL(url).host;
  } catch {
    return "ค่า URL ไม่ถูกรูปแบบ";
  }
}

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
  // "busy" คือกำลังเพิ่มสิทธิ์ให้ลูกค้าอยู่ ไม่ใช่ปัญหา — ห้ามเตือน
  if (primaryUp) {
    return NextResponse.json({
      ok: true,
      primaryUp: true,
      primaryBusy: health.primary?.busy ?? false,
      backupUp,
      alerted: false,
    });
  }

  // ตัวหลักล่ม — เตือนแอดมิน พร้อมบอกว่าเว็บยิงไปโฮสต์ไหน และต้องกู้เครื่องไหน
  const silent = health.primary?.silentMinutes;
  const lines = [
    `🔴 บริดจ์ TradingView ตัวหลัก (${PRIMARY_NAME}) ติดต่อไม่ได้`,
    ...(silent ? [`เงียบติดต่อกันมาแล้ว ${silent} นาที`] : []),
    `เว็บยิงไปที่: ${hostOf(health.primary?.url)}`,
    "",
    "ผลกระทบ: ถ้ามีลูกค้าซื้อตอนนี้ บอทจะเพิ่มสิทธิ์ให้ไม่ได้",
    "",
    backupConfigured
      ? backupUp
        ? `✅ ${BACKUP_NAME} (ตัวสำรอง) เปิดอยู่ — เว็บสลับไปใช้ให้อัตโนมัติแล้ว ระบบยังทำงานต่อได้`
        : `⚠️ ${BACKUP_NAME} (ตัวสำรอง · ${hostOf(health.backup?.url)}) ก็ติดต่อไม่ได้ — ตอนนี้ไม่มีบริดจ์ทำงานเลย`
      : "ℹ️ ยังไม่ได้ตั้งบริดจ์สำรอง",
  ];

  if (!primaryUp && !backupUp) {
    lines.push(
      "",
      "ต้องทำ (อย่างใดอย่างหนึ่ง):",
      `1) เช็ก${PRIMARY_NAME} — เปิดเครื่องและ login ไว้ไหม (botkeeper เปิดเองตอน login แล้วปลุกบริดจ์ + อัปเดต TV_BOT_URL ให้)`,
      `   ถ้าเครื่องเปิดอยู่แต่บริดจ์ไม่ขึ้น ให้ดู C:\\BotTV\\keeper.log — ถ้าวน "bridge down -> starting"`,
      `   แปลว่า Chrome ค้างล็อกโปรไฟล์ไว้ ให้ปิด chrome.exe + chromedriver.exe ทิ้ง แล้ว keeper จะปลุกเอง`,
      `2) ปลุก${BACKUP_NAME} แล้วเปิดบริดจ์ (ดู docs/TRADINGVIEW.md หัวข้อคอมเบส)`,
      "",
      "เว็บสลับไปตัวที่กลับมาก่อนให้เอง — ไม่ต้องแก้ค่าอะไร"
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
