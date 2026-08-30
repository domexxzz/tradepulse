import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAdminAlert, sendPhotoToUser } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const schema = z.object({
  secret: z.string(),
  action: z.enum(["grant", "revoke"]),
  username: z.string().min(1).max(60),
  ok: z.boolean(),
  error: z.string().max(500).nullish(),
  /**
   * ภาพหลักฐานสิทธิ์ (PNG base64) ที่บอทแคปจากกล่อง Manage access
   *
   * เพดาน 1.5 ล้านตัวอักษร ~ ไฟล์ 1.1 MB ยังห่างลิมิต body 4.5 MB ของ Vercel
   * ภาพจริงจาก tvshot.py อยู่ราว 400 KB จึงเหลือที่เผื่อไว้พอสมควร
   */
  proof: z.string().max(1_500_000).nullish(),
});

/** PNG ขึ้นต้นด้วยลายเซ็น 8 ไบต์นี้เสมอ — base64 พังจะ decode ผ่านแต่ไม่ใช่รูป */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** เทียบ secret แบบไม่รั่วเวลา (กันการเดาทีละตัวอักษรจากเวลาตอบกลับ) */
function secretMatches(given: string): boolean {
  const expected = process.env.TV_BOT_SECRET;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * บอท TradingView รายงานผลกลับมาที่นี่
 *
 * ทำไมต้องมีเส้นทางนี้: บอทกดหน้าเว็บ TradingView จริงผ่าน Selenium ใช้เวลา 60-120 วินาที
 * เว็บยืนรอไม่ได้ (Vercel จำกัดเวลา request) จึงสั่งแล้วปล่อย แล้วให้บอทยิงผลกลับทีหลัง
 *
 * ผลที่ล้มเหลวจะไม่ปิดคิว — ปล่อยค้างไว้ให้แอดมินทำมือ พร้อมแจ้งเตือนทาง Telegram
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { secret, action, username, ok, error, proof } = parsed.data;
  if (!secretMatches(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // หาคิวสิทธิ์จาก username โดยตรง (ผ่าน relation) — กัน username ซ้ำหลายบัญชี
  // ถ้าค้นจาก user ก่อนแล้วเผอิญเจอบัญชีที่ไม่มีคิว จะพลาดเป็น 404 ทั้งที่อีกบัญชีมีคิวอยู่
  // จึงค้นที่ accessGrant ที่ผูกกับ user ซึ่ง tradingViewUsername ตรง แล้วเลือกคิวล่าสุด
  const grant = await prisma.accessGrant.findFirst({
    where: {
      user: { tradingViewUsername: { equals: username, mode: "insensitive" } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, telegramUserId: true } },
    },
  });
  if (!grant) {
    return NextResponse.json(
      { error: "ไม่พบคิวสิทธิ์ของ username นี้" },
      { status: 404 }
    );
  }
  const user = grant.user;

  const now = new Date();

  if (!ok) {
    await prisma.accessGrant.update({
      where: { id: grant.id },
      data: { note: `บอททำงานไม่สำเร็จ: ${error ?? "ไม่ทราบสาเหตุ"}` },
    });
    await sendAdminAlert(
      `⚠️ บอท TradingView ${action === "grant" ? "ให้สิทธิ์" : "ถอนสิทธิ์"}ไม่สำเร็จ
สมาชิก: ${user.name ?? user.email}
TradingView: @${username}
สาเหตุ: ${error ?? "ไม่ทราบ"}
ต้องทำมือที่ /admin/access-queue`
    );
    return NextResponse.json({ ok: true, handled: "failure" });
  }

  await prisma.accessGrant.update({
    where: { id: grant.id },
    data:
      action === "grant"
        ? { status: "GRANTED", grantedAt: now, revokedAt: null, note: "ให้สิทธิ์อัตโนมัติโดยบอท" }
        : { status: "REVOKED", revokedAt: now, note: "ถอนสิทธิ์อัตโนมัติโดยบอท (หมดอายุ)" },
  });

  // ส่งภาพหลักฐานให้ลูกค้า — เฉพาะตอนให้สิทธิ์สำเร็จและบอทแนบภาพมาจริง
  // ตอนถอนสิทธิ์ไม่ต้องส่ง ไม่มีอะไรให้ยืนยัน
  const proofResult =
    action === "grant" && proof
      ? await deliverProof(proof, user, username)
      : undefined;

  return NextResponse.json({ ok: true, handled: action, proof: proofResult });
}

interface ProofTarget {
  name: string | null;
  email: string | null;
  telegramUserId: string | null;
}

/**
 * ส่งภาพหลักฐานเข้า DM ของลูกค้า
 *
 * ไม่โยน error ออกไป — งานหลัก (บันทึกว่าให้สิทธิ์แล้ว) จบไปก่อนหน้านี้แล้ว
 * ถ้าส่งรูปพลาดต้องไม่ทำให้บอทคิดว่า callback ล้มแล้วยิงซ้ำ
 * กรณีที่ส่งไม่ได้จะเด้งหาแอดมินให้ส่งต่อมือแทน
 */
async function deliverProof(
  proof: string,
  user: ProofTarget,
  username: string
): Promise<string> {
  const who = user.name ?? user.email ?? username;

  if (!user.telegramUserId) {
    await sendAdminAlert(
      `📸 มีภาพหลักฐานสิทธิ์แต่ส่งไม่ได้\n` +
        `สมาชิก: ${who}\nTradingView: @${username}\n` +
        `สาเหตุ: ยังไม่ได้ผูกบัญชี Telegram`
    );
    return "no-telegram-account";
  }

  const png = Buffer.from(proof, "base64");
  if (png.length < 100 || !png.subarray(0, 8).equals(PNG_MAGIC)) {
    await sendAdminAlert(
      `📸 บอทส่งภาพหลักฐานมาแต่ไม่ใช่ไฟล์ PNG (${png.length} ไบต์)\n` +
        `สมาชิก: ${who}\nTradingView: @${username}`
    );
    return "invalid-png";
  }

  const result = await sendPhotoToUser(
    user.telegramUserId,
    png,
    `✅ ยืนยันสิทธิ์อินดิเคเตอร์เรียบร้อยแล้ว\n` +
      `TradingView: @${username}\n\n` +
      `ภาพนี้คือหน้าจอสิทธิ์จริงจากบัญชีเจ้าของสคริปต์ ` +
      `เปิด TradingView แล้วเรียกอินดิเคเตอร์ขึ้นมาใช้ได้เลย`
  );
  if (result.sent) return "sent";

  await sendAdminAlert(
    `📸 ส่งภาพหลักฐานให้ลูกค้าไม่สำเร็จ\n` +
      `สมาชิก: ${who}\nTradingView: @${username}\n` +
      `สาเหตุ: ${result.reason ?? "ไม่ทราบ"}\n` +
      (result.needsStart
        ? "สมาชิกยังไม่เคยกด Start กับบอท — Telegram ห้ามบอททักก่อน ต้องส่งภาพให้เองไปก่อน"
        : "ลองส่งใหม่หรือส่งภาพให้เอง")
  );
  return result.needsStart ? "needs-start" : "failed";
}
