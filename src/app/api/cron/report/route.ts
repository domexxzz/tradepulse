import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminAlert } from "@/lib/telegram";
import { checkBridgeHealth } from "@/lib/tradingview";
import { checkStaleJobs } from "@/lib/heartbeat";
import { usersAwaitingInviteEmail } from "@/lib/telegram-invite";

export const dynamic = "force-dynamic";

/**
 * รายงานสภาพระบบเข้า Telegram — เจ้าของอ่านแล้วรู้ทันทีว่าต้องลงมือตรงไหน
 *
 * ทำไมต้องมี: แจ้งเตือนตัวอื่นยิงเฉพาะตอน "มีเรื่อง" ซึ่งแปลว่าความเงียบมีสองความหมาย
 * ปกติดี กับ ตัวเฝ้าเองก็พังไปแล้ว แยกไม่ออก — ตัวนี้ส่งทุกครั้งที่ถูกเรียก
 * ได้ข้อความแปลว่าระบบเฝ้ายังเดินอยู่จริง ไม่ได้แปลว่าไม่มีปัญหา
 * (เจอจริง 30 ก.ย. 69 — บริดจ์ตาย 13 ชม. คิวค้าง 15 ราย เงียบสนิทไม่มีใครรู้)
 *
 * ตัวเลขทั้งหมดมาจากฐานข้อมูลจริง ไม่รับจากผู้เรียก
 *
 * ส่ง note มาได้ (POST) เพื่อแนบบันทึกของคนทำงาน เช่น สรุปว่าวันนี้แก้อะไรไป
 * แต่ต่อท้ายใต้หัวข้อที่เขียนชัดว่า "ส่งผ่าน API" เสมอ ห้ามให้ข้อความของคน
 * ไปปนกับบรรทัดสถานะจนดูเหมือนระบบเป็นคนพูดเอง — ถ้า CRON_SECRET หลุด
 * คนที่ได้ไปจะได้ไม่สามารถปลอมเป็นเสียงของระบบมาหลอกแอดมินในกลุ่มได้
 */
const NOTE_MAX = 3500;
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

const mark = (bad: boolean) => (bad ? "⚠️" : "✅");

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [health, stale, awaitingInvite, grantsPending, noUsername, slipsPending, brokerPending, activeSubs] =
    await Promise.all([
      checkBridgeHealth(),
      checkStaleJobs(),
      usersAwaitingInviteEmail(),
      prisma.accessGrant.count({ where: { status: "PENDING" } }),
      prisma.accessGrant.count({ where: { status: "PENDING", tradingViewUsername: null } }),
      // สลิปที่ลูกค้าส่งมาแล้วยังไม่ได้ตัดสิน — ชื่อสถานะตรงกับ /api/cron/slips
      prisma.slipOrder.count({ where: { status: "SUBMITTED" } }),
      prisma.brokerApplication.count({ where: { status: "PENDING" } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
    ]);

  // คิวที่บอททำเองไม่ได้ (ลูกค้ายังไม่กรอก username) ไม่ใช่ความผิดของระบบ — แยกนับ
  const grantsStuck = grantsPending - noUsername;
  const primaryUp = health.primary?.up ?? false;
  const silent = health.primary?.silentMinutes;

  const lines = [
    "📋 รายงานสภาพระบบ QVX",
    "",
    `${mark(!primaryUp)} บริดจ์ TradingView: ${
      primaryUp ? (health.primary?.busy ? "ทำงานอยู่ (กำลังเพิ่มสิทธิ์)" : "ปกติ") : "ติดต่อไม่ได้"
    }${silent ? ` — เงียบมา ${silent} นาที` : ""}`,
    `${mark(grantsStuck > 0)} คิวเพิ่มสิทธิ์ค้าง: ${grantsStuck} ราย`,
    `${mark(slipsPending > 0)} สลิปรอตรวจ: ${slipsPending} ใบ`,
    `${mark(brokerPending > 0)} คำขอผ่านโบรกรอ: ${brokerPending} ราย`,
    `${mark(awaitingInvite.length > 0)} รอส่งลิงก์ Telegram: ${awaitingInvite.length} ราย`,
    `${mark(stale.length > 0)} งานเบื้องหลังที่หยุดไป: ${stale.length > 0 ? stale.map((s) => s.name).join(", ") : "ไม่มี"}`,
    "",
    `สมาชิกที่ใช้งานอยู่: ${activeSubs} ราย`,
    ...(noUsername > 0 ? ["", `ℹ️ อีก ${noUsername} รายยังไม่กรอกชื่อ TradingView — ต้องรอลูกค้า ระบบทำเองไม่ได้`] : []),
  ];

  // บันทึกจากคน — ต่อท้ายใต้หัวข้อที่แยกชัด ไม่ปนกับบรรทัดสถานะด้านบน
  let note = "";
  if (req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
    if (typeof body?.note === "string" && body.note.trim()) {
      note = body.note.trim().slice(0, NOTE_MAX);
    }
  }
  if (note) {
    lines.push("", "━━━━━━━━━━━━━━━", "📝 บันทึกจากผู้ดูแลระบบ (ส่งผ่าน API)", "", note);
  }

  const result = await sendAdminAlert(lines.join("\n"));
  return NextResponse.json({
    ok: result.sent,
    ...result,
    summary: { primaryUp, grantsStuck, noUsername, slipsPending, brokerPending, awaitingInvite: awaitingInvite.length, stale: stale.length, activeSubs },
  });
}

export const GET = run;
export const POST = run;
