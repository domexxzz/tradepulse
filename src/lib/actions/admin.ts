"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { plans } from "@/config/plans";
import { channelLabel, isRevenueChannel } from "@/config/channels";
import { activateMembership, expireSubscriptionById, syncTradingViewGrant } from "@/lib/lifecycle";
import { removeGroupMember, telegramGroupManaged } from "@/lib/telegram";

export async function grantAccess(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("grantId") ?? "");
  if (!id) return;
  await prisma.accessGrant.update({
    where: { id },
    data: { status: "GRANTED", grantedAt: new Date(), revokedAt: null },
  });
  revalidatePath("/admin/access-queue");
  revalidatePath("/admin");
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

/** ลองให้สิทธิ์ TradingView ผ่านบอทอีกครั้ง (ใช้ตอนบอทล่มตอนแรก) */
export async function adminRetryTradingView(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await syncTradingViewGrant(userId);

  revalidatePath("/admin/access-queue");
}
