import { NextResponse } from "next/server";
import { runReconcile } from "@/lib/reconcile";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
/** ไล่ได้หลายคิวต่อรอบ แต่ละคิวคุยกับบริดจ์จริง ต้องเผื่อเวลา */
export const maxDuration = 120;

/**
 * ไล่งานที่ค้างไม่สำเร็จให้จบเอง — ทำให้ระบบเดินต่อได้โดยไม่ต้องมีคนเฝ้า
 *
 * ต่างจาก /api/cron/expire ที่ดูแล "คนหมดอายุ" ตัวนี้ดูแล "งานที่สั่งแล้วไม่สำเร็จ"
 * เช่นบริดจ์ล่มตอนลูกค้าจ่ายเงิน หรือ Telegram ล่มตอนสร้างลิงก์เชิญ
 *
 * เรียกจาก GitHub Actions ทุก ~10 นาที (Vercel Hobby ให้ cron วันละครั้ง)
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

  try {
    const result = await runReconcile();
    const acted = result.grantsRetried + result.revokesRetried + result.invitesCreated;

    // แจ้งเฉพาะตอนมีอะไรให้รู้จริง ๆ — ไม่งั้นแอดมินจะโดนสแปมทุก 10 นาที
    if (acted > 0) {
      const lines = ["🔧 ระบบไล่งานค้างให้อัตโนมัติ"];
      if (result.grantsRetried) lines.push(`· สั่งบอทให้สิทธิ์ซ้ำ ${result.grantsRetried} คิว`);
      if (result.revokesRetried) lines.push(`· สั่งบอทถอนสิทธิ์ซ้ำ ${result.revokesRetried} คิว`);
      if (result.invitesCreated) lines.push(`· สร้างลิงก์เชิญ Telegram ย้อนหลัง ${result.invitesCreated} คน`);
      lines.push("", "ผลจริงจะตามมาทาง callback อีก 1-3 นาที");
      await sendAdminAlert(lines.join("\n")).catch((e) =>
        console.error("reconcile alert failed:", e)
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron/reconcile failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}

export const GET = run;
export const POST = run;
