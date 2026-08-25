import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import {
  approveJoinRequest,
  declineJoinRequest,
  revokeInviteLink,
  sendAdminAlert,
  telegramGroupManaged,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

interface JoinRequest {
  chat: { id: number };
  from: { id: number; username?: string; first_name?: string };
  invite_link?: { invite_link: string; name?: string };
}

/**
 * รับเหตุการณ์จาก Telegram — ตอนนี้สนใจเฉพาะ "คำขอเข้ากลุ่ม"
 *
 * ลิงก์เชิญของเราถูกตั้งให้ต้องขออนุมัติก่อนเข้า และตั้งชื่อลิงก์เป็นรหัสคิว
 * พอมีคนกด Telegram จะส่งมาที่นี่พร้อมบอกว่าใช้ลิงก์ใบไหน
 * เราจึงเช็คได้ว่าเจ้าของลิงก์ยังจ่ายเงินอยู่จริงก่อนปล่อยเข้ากลุ่ม
 *
 * ยืนยันตัวตนด้วย header ที่ Telegram แนบมาให้ (ตั้งตอน setWebhook)
 * ไม่ใช่การเช็ค IP — เพราะ Telegram ไม่รับประกันช่วง IP ที่ตายตัว
 */
function authorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

/** ตอบ 200 เสมอเมื่อยืนยันตัวตนผ่าน ไม่งั้น Telegram จะยิงซ้ำไม่เลิก */
const ok = (handled: string) => NextResponse.json({ ok: true, handled });

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!telegramGroupManaged) return ok("telegram ยังไม่ได้ตั้งค่า");

  let update: { chat_join_request?: JoinRequest };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const request = update.chat_join_request;
  if (!request) return ok("ไม่ใช่เหตุการณ์ที่สนใจ");

  if (String(request.chat.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
    return ok("คนละกลุ่ม");
  }

  const telegramUserId = String(request.from.id);
  const displayName = request.from.username
    ? `@${request.from.username}`
    : (request.from.first_name ?? telegramUserId);
  const grantId = request.invite_link?.name;

  // เข้ามาโดยไม่ได้ใช้ลิงก์ส่วนตัวของเรา = ไม่รู้ว่าเป็นสมาชิกคนไหน
  if (!grantId) {
    await declineJoinRequest(telegramUserId).catch(() => {});
    await sendAdminAlert(
      `🚫 ปฏิเสธคำขอเข้ากลุ่ม: ${displayName}\nไม่ได้ใช้ลิงก์เชิญส่วนตัวจากหน้าบัญชี`
    );
    return ok("ไม่มีลิงก์อ้างอิง");
  }

  const grant = await prisma.telegramGrant.findUnique({
    where: { id: grantId },
    include: { user: { select: { id: true, name: true, email: true, telegramUserId: true } } },
  });

  if (!grant) {
    await declineJoinRequest(telegramUserId).catch(() => {});
    return ok("ไม่พบคิวของลิงก์นี้");
  }

  const deny = async (reason: string) => {
    await declineJoinRequest(telegramUserId).catch(() => {});
    await prisma.telegramGrant.update({
      where: { id: grant.id },
      data: { note: `ปฏิเสธคำขอจาก ${displayName}: ${reason}` },
    });
    await sendAdminAlert(
      `🚫 ปฏิเสธคำขอเข้ากลุ่ม\nสมาชิก: ${grant.user.name ?? grant.user.email}\nTelegram: ${displayName}\nเหตุผล: ${reason}`
    );
    return ok("ปฏิเสธ");
  };

  // ลิงก์ใบเดียวใช้ได้คนเดียว — ใบที่ใช้แล้วคือถูกส่งต่อให้คนอื่น
  if (grant.status === "ADDED" && grant.telegramUserId !== telegramUserId) {
    return deny("ลิงก์นี้ถูกใช้ไปแล้ว");
  }

  const { isActive } = await getUserSubscription(grant.userId);
  if (!isActive) return deny("แพ็กเกจหมดอายุหรือยังไม่เปิดใช้งาน");

  // บัญชี Telegram หนึ่งอันผูกได้กับสมาชิกคนเดียว (กันแชร์บัญชีกันใช้)
  const taken = await prisma.user.findFirst({
    where: { telegramUserId, NOT: { id: grant.userId } },
    select: { id: true },
  });
  if (taken) return deny("บัญชี Telegram นี้ถูกใช้กับสมาชิกรายอื่นแล้ว");

  await approveJoinRequest(telegramUserId);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: grant.userId },
      data: { telegramUserId, telegramUsername: request.from.username ?? null },
    }),
    prisma.telegramGrant.update({
      where: { id: grant.id },
      data: {
        status: "ADDED",
        addedAt: new Date(),
        telegramUserId,
        note: `เข้ากลุ่มอัตโนมัติ (${displayName})`,
      },
    }),
  ]);

  // ปิดลิงก์ทิ้งทันที กันถูกส่งต่อให้คนอื่นใช้
  if (grant.inviteLink) await revokeInviteLink(grant.inviteLink).catch(() => {});

  return ok("อนุมัติแล้ว");
}
