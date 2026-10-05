import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAdminAlert, sendPhotoToUser } from "@/lib/telegram";
import { notifyAccessGranted } from "@/lib/access-notify";
import { sendEmail } from "@/lib/email";
import { tradingViewNotFoundEmail } from "@/lib/email-templates";

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
    const reason = error ?? "ไม่ทราบสาเหตุ";
    /**
     * ชื่อที่ลูกค้ากรอกไม่มีอยู่จริงบน TradingView — ลองอีกกี่ครั้งก็ไม่สำเร็จ
     * เป็นเรื่องที่มีแต่ลูกค้าเท่านั้นที่แก้ได้ แอดมินทำแทนไม่ได้
     */
    const noSuchUser = /ไม่พบ\s*username|not\s*found|ไม่มีผู้ใช้/i.test(reason);

    const before = await prisma.accessGrant.findUnique({
      where: { id: grant.id },
      select: { failCount: true, lastFailReason: true },
    });
    const fails = (before?.failCount ?? 0) + 1;

    await prisma.accessGrant.update({
      where: { id: grant.id },
      data: {
        note: `บอททำงานไม่สำเร็จ: ${reason}`,
        failCount: fails,
        lastFailReason: reason,
      },
    });

    /**
     * เตือนเฉพาะครั้งแรก หรือเมื่อเหตุผลเปลี่ยน
     *
     * ของเดิมเตือนทุกครั้งที่ callback ตอบว่าไม่สำเร็จ พอ reconcile สั่งซ้ำทุก 5 นาที
     * แอดมินจึงได้ข้อความเดิมไม่หยุดจนเลิกอ่าน ซึ่งอันตรายกว่าไม่มีแจ้งเตือน
     */
    const sameAsBefore = before?.lastFailReason === reason && (before?.failCount ?? 0) > 0;
    if (!sameAsBefore) {
      await sendAdminAlert(
        `⚠️ บอท TradingView ${action === "grant" ? "ให้สิทธิ์" : "ถอนสิทธิ์"}ไม่สำเร็จ
สมาชิก: ${user.name ?? user.email}
TradingView: @${username}
สาเหตุ: ${reason}` +
          (noSuchUser
            ? `\n\nชื่อนี้ไม่มีอยู่จริงบน TradingView — ส่งอีเมลให้ลูกค้าไปแก้เองแล้ว
ระบบจะเลิกลองซ้ำหลังพลาดครบ 5 ครั้ง เพื่อไม่ให้กินคิวบอท`
            : `\nต้องทำมือที่ /admin/access-queue`)
      );
    }

    // บอกลูกค้าตรง ๆ ว่าชื่อที่กรอกใช้ไม่ได้ เพราะมีแต่เขาที่แก้ได้
    if (noSuchUser && fails === 1 && user.email) {
      const mail = tradingViewNotFoundEmail({ name: user.name, username });
      await sendEmail({ to: user.email, ...mail }).catch(() => {});
    }

    return NextResponse.json({ ok: true, handled: "failure", failCount: fails });
  }

  await prisma.accessGrant.update({
    where: { id: grant.id },
    data:
      action === "grant"
        ? { status: "GRANTED", grantedAt: now, revokedAt: null, note: "ให้สิทธิ์อัตโนมัติโดยบอท" }
        : { status: "REVOKED", revokedAt: now, note: "ถอนสิทธิ์อัตโนมัติโดยบอท (หมดอายุ)" },
  });

  // บอกลูกค้าว่าเพิ่มให้แล้ว พร้อมลิงก์เชิญกลุ่ม Telegram
  //
  // ทางนี้คือทางปกติที่สิทธิ์ถูกเปิด (บอททำเอง) แต่เดิมไม่มีการแจ้งเลย
  // มีแค่ตอนแอดมินกดปุ่มในคิวด้วยมือ ลิงก์ Telegram เลยค้างอยู่ในหน้าบัญชี
  // โดยที่ลูกค้าไม่รู้ว่ามี — เห็นได้จากสถานะ "ส่งลิงก์แล้ว ยังไม่ได้กดเข้า" ที่ค้างหลายราย
  //
  // ห้ามให้การแจ้งเตือนทำให้ callback ล้ม ไม่งั้นบอทจะคิดว่าส่งผลไม่สำเร็จแล้วยิงซ้ำ
  if (action === "grant" && grant) {
    try {
      await notifyAccessGranted(grant.userId, username);
    } catch (e) {
      console.error("notify access granted failed:", e);
    }
  }

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
