"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { plans } from "@/config/plans";
import { channelLabel, isRevenueChannel } from "@/config/channels";
import {
  activateMembership,
  ensureTelegramInvite,
  expireSubscriptionById,
  syncTradingViewGrant,
} from "@/lib/lifecycle";
import { removeGroupMember, sendAdminAlert, telegramGroupManaged } from "@/lib/telegram";
import { revokeTradingViewAccess } from "@/lib/tradingview";
import { sendEmail } from "@/lib/email";
import { accessGrantedEmail } from "@/lib/email-templates";
import { getUserSubscription } from "@/lib/subscription";

export async function grantAccess(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  const grant = await prisma.accessGrant.update({
    where: { id },
    data: { status: "GRANTED", grantedAt: new Date(), revokedAt: null },
  });

  // แจ้งลูกค้าว่าอินดิเคเตอร์เข้าบัญชีแล้ว + แนบลิงก์กลุ่ม Telegram
  // ห้ามให้ขั้นตอนแจ้งเตือนทำให้การให้สิทธิ์ล้ม จึงกลืน error ไว้ทั้งหมด
  try {
    await notifyAccessGranted(grant.userId, grant.tradingViewUsername);
  } catch (e) {
    console.error("notify access granted failed:", e);
  }

  revalidatePath("/admin/access-queue");
  revalidatePath("/admin");
}

/** ส่งอีเมล "เพิ่มอินดิเคเตอร์ให้แล้ว" พร้อมลิงก์เชิญ Telegram ส่วนตัว */
async function notifyAccessGranted(userId: string, tvUsername: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, tradingViewUsername: true },
  });
  if (!user?.email) return;

  // มีแพ็กเกจใช้งานอยู่ถึงจะมีสิทธิ์เข้ากลุ่ม — สร้างลิงก์เชิญให้ถ้ายังไม่มี
  const { sub, isActive } = await getUserSubscription(userId);
  if (isActive) await ensureTelegramInvite(userId);

  const tg = await prisma.telegramGrant.findFirst({
    where: { userId, status: { in: ["PENDING", "ADDED"] } },
    orderBy: { createdAt: "desc" },
    select: { inviteLink: true },
  });

  const mail = accessGrantedEmail({
    name: user.name,
    tvUsername: tvUsername ?? user.tradingViewUsername ?? "-",
    until: isActive ? sub?.currentPeriodEnd ?? null : null,
    telegramInviteUrl: tg?.inviteLink ?? null,
  });
  await sendEmail({ to: user.email, ...mail });
}

export async function revokeAccess(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.accessGrant.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  revalidatePath("/admin/access-queue");
  revalidatePath("/admin");
}

export async function approveReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  await prisma.review.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

export async function unapproveReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  await prisma.review.update({ where: { id }, data: { isApproved: false } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

export async function deleteReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("reviewId") ?? "");
  if (!id) return;
  await prisma.review.delete({ where: { id } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

export async function grantTelegram(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.telegramGrant.update({
    where: { id },
    data: { status: "ADDED", addedAt: new Date(), removedAt: null },
  });
  revalidatePath("/admin/telegram");
  revalidatePath("/admin");
}

/**
 * นำออกจากกลุ่ม — พยายามเตะออกจริงก่อนถ้ารู้ว่าเป็นใคร
 * เตะไม่สำเร็จก็ยังบันทึกสถานะให้ พร้อมบอกเหตุผลไว้ในโน้ต ให้แอดมินไปทำมือต่อ
 */
export async function revokeTelegram(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;

  const grant = await prisma.telegramGrant.findUnique({
    where: { id },
    select: { telegramUserId: true, user: { select: { telegramUserId: true } } },
  });
  const telegramUserId = grant?.telegramUserId ?? grant?.user.telegramUserId;

  let note = "แอดมินนำออกเอง";
  if (telegramGroupManaged && telegramUserId) {
    try {
      await removeGroupMember(telegramUserId);
      note = "นำออกจากกลุ่มแล้ว (แอดมินสั่ง)";
    } catch (e) {
      note = `เตะออกจากกลุ่มไม่สำเร็จ: ${e instanceof Error ? e.message : "ไม่ทราบสาเหตุ"}`;
    }
  }

  await prisma.telegramGrant.update({
    where: { id },
    data: { status: "REMOVED", removedAt: new Date(), note },
  });
  revalidatePath("/admin/telegram");
  revalidatePath("/admin");
}

/**
 * ยกเลิกการผูกบัญชี Telegram ของสมาชิก — ปล่อยบัญชี Telegram นั้นให้ว่าง
 *
 * จำเป็นเพราะ User.telegramUserId เป็น unique และ webhook ปฏิเสธการผูกซ้ำเสมอ
 * ถ้า Telegram ของใครไปติดกับบัญชีเว็บผิดคน (สมัครซ้ำสองบัญชี เปลี่ยนบัญชี
 * Telegram หรือกดลิงก์ผูกผิดตัว) เขาจะติดถาวรและไม่มีใครแก้ให้ได้เลย
 *
 * ล้างเฉพาะสองคอลัมน์ในตาราง User — ตั้งใจไม่แตะ TelegramGrant.telegramUserId
 * เพราะนั่นคือตัวที่ใช้เตะออกจากกลุ่มตอนหมดอายุ (ดู revokeTelegram ด้านบน)
 * ล้างไปด้วยจะกลายเป็นคนที่ค้างอยู่ในกลุ่มโดยไม่มีใครเตะออกได้
 *
 * ไม่ต้องถามยืนยันก่อนกด เพราะย้อนกลับง่าย สมาชิกกดผูกใหม่จากหน้าบัญชีได้ทันที
 * (ต่างจากปุ่ม "นำออก" ที่เตะออกจากกลุ่มจริง)
 */
export async function unlinkTelegram(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;

  const grant = await prisma.telegramGrant.findUnique({
    where: { id },
    select: {
      userId: true,
      user: {
        select: { name: true, email: true, telegramUserId: true, telegramUsername: true },
      },
    },
  });
  // ไม่มีอะไรให้ปลด — กดซ้ำหรือกดผิดแถวก็ไม่เกิดอะไร
  if (!grant?.user.telegramUserId) return;

  const { telegramUserId, telegramUsername } = grant.user;
  await prisma.user.update({
    where: { id: grant.userId },
    data: { telegramUserId: null, telegramUsername: null },
  });

  // ปลดสิทธิ์แบบนี้ต้องตามรอยได้ว่าใครสั่ง ไม่งั้นบัญชีหลุดมือแล้วหาต้นเหตุไม่เจอ
  await sendAdminAlert(
    `🔓 ยกเลิกการผูกบัญชี Telegram\n` +
      `สมาชิก: ${grant.user.name ?? grant.user.email}\n` +
      `Telegram ที่ปลด: ${telegramUsername ? `@${telegramUsername}` : telegramUserId}\n` +
      `แอดมินที่สั่ง: ${session.user?.email ?? session.user?.name ?? "ไม่ทราบ"}`
  );

  revalidatePath("/admin/telegram");
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ */
/* จัดการอายุสมาชิกด้วยมือ — ใช้ตอนโอนนอกระบบ ชดเชย หรือแก้เคสพิเศษ      */
/* ------------------------------------------------------------------ */

/**
 * เปิด/ต่ออายุแพ็กเกจให้สมาชิกโดยไม่ผ่านออเดอร์บนเว็บ
 *
 * ใช้กับลูกค้าที่ทักมาทาง LINE / เพจ / TikTok แล้วโอนตรง ซึ่งเป็นช่องทางหลักช่องทางหนึ่ง
 * บันทึกยอดจริงและช่องทางไว้ด้วย ไม่งั้นรายได้รวมจะต่ำกว่าความจริง
 * และตอบไม่ได้ว่าช่องทางไหนขายดี — เลือก "แถมให้" เมื่อไม่คิดเงิน
 */
export async function adminActivateMembership(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const planCode = String(formData.get("planCode") ?? "");
  const channel = String(formData.get("channel") ?? "transfer");
  const plan = plans.find((p) => p.id === planCode);
  if (!userId || !plan) return;

  // ไม่กรอกยอด = ใช้ราคาป้ายของแพ็กเกจนั้น (กรณีปกติ) · แถมให้ = 0 เสมอ
  const raw = String(formData.get("amountTHB") ?? "").trim();
  const amountTHB = !isRevenueChannel(channel)
    ? 0
    : raw === ""
      ? plan.priceTHB
      : Math.max(0, Math.round(Number(raw) || 0));

  await activateMembership({
    userId,
    planCode,
    amountTHB,
    provider: channel,
    // เวลาในคีย์ทำให้เปิดสิทธิ์ซ้ำได้ (ต่ออายุหลายรอบ) โดยยังกันบันทึกซ้ำของรอบเดิม
    providerRef: `manual_${userId}_${Date.now()}`,
    source: `แอดมินเปิดสิทธิ์เอง · ${channelLabel(channel)}`,
  });

  revalidatePath("/admin/members");
  revalidatePath("/admin");
}

/** ปิดสิทธิ์ทันทีโดยไม่รอ cron (คืนเงิน / ผิดเงื่อนไข) */
export async function adminExpireMembership(formData: FormData) {
  await requireAdmin();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  if (!subscriptionId) return;

  await expireSubscriptionById(subscriptionId);

  revalidatePath("/admin/members");
  revalidatePath("/admin");
}

/**
 * สั่งบอทเพิ่ม/ต่ออายุสิทธิ์ TradingView
 *
 * ใช้ได้ทั้งตอนบอทล่มรอบแรก และตอนต่ออายุให้ลูกค้าเดิม — บอทฝั่งคอมเบสจะลบ
 * username เดิมออกแล้วเพิ่มกลับพร้อมวันหมดอายุใหม่ให้เอง เพราะ TradingView
 * ไม่ยอมให้แก้วันของคนที่มีสิทธิ์อยู่แล้วผ่านหน้าจอเพิ่มผู้ใช้
 */
export async function adminRetryTradingView(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  // แอดมินกรอกจำนวนวันได้ (ค่าว่าง/ไม่ถูกต้อง = ยึดตามวันหมดอายุแพ็กเกจ)
  const daysRaw = Number(formData.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : undefined;
  await syncTradingViewGrant(userId, days);

  revalidatePath("/admin/access-queue");
}

/**
 * สั่งบอทถอน username ออกจากสคริปต์บน TradingView จริง ๆ
 *
 * ต่างจากปุ่ม "ยกเลิก" ที่บันทึกสถานะเฉย ๆ — อันนี้ไปกดลบบนหน้า TradingView ให้
 * ผลจริงจะตามมาทาง callback เหมือนตอนให้สิทธิ์ (Selenium ใช้เวลาเป็นนาที)
 */
export async function adminRevokeTradingView(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tradingViewUsername: true },
  });
  if (!user?.tradingViewUsername) return;

  const res = await revokeTradingViewAccess(user.tradingViewUsername);

  const grant = await prisma.accessGrant.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (grant) {
    await prisma.accessGrant.update({
      where: { id: grant.id },
      data: res.ok
        ? { note: "สั่งบอทถอนสิทธิ์แล้ว รอผลยืนยัน" }
        : { note: `สั่งบอทถอนสิทธิ์ไม่สำเร็จ: ${res.reason ?? "ไม่ทราบสาเหตุ"}` },
    });
  }

  revalidatePath("/admin/access-queue");
}
