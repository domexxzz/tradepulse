import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { mapStatus } from "@/lib/stripe";

/** สร้าง/อัปเดต subscription จากข้อมูล Stripe (idempotent) */
export async function upsertSubscription(
  userId: string,
  planCode: string | undefined,
  sub: Stripe.Subscription
) {
  const status = mapStatus(sub.status);
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        planCode: planCode ?? existing.planCode,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        planCode: planCode ?? "MONTH",
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
  }
}

/** บันทึกใบเสร็จแบบกันซ้ำ (idempotent ตาม providerRef) */
export async function recordPayment(userId: string, amountTHB: number, providerRef: string) {
  const exists = await prisma.payment.findFirst({ where: { providerRef } });
  if (exists) return;
  await prisma.payment.create({
    data: { userId, amountTHB, provider: "stripe", providerRef, status: "paid" },
  });
}

/** สร้างคิวขอสิทธิ์ TradingView เฉพาะเมื่อยังไม่มีที่ active อยู่ (กันซ้ำ) */
export async function ensureAccessGrant(userId: string) {
  const existing = await prisma.accessGrant.findFirst({
    where: { userId, status: { in: ["PENDING", "GRANTED"] } },
  });
  if (existing) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.accessGrant.create({
    data: { userId, status: "PENDING", tradingViewUsername: user?.tradingViewUsername ?? null },
  });
}

/** สร้างคิวขอสิทธิ์กลุ่ม Telegram เมื่อจ่ายเงิน (กันซ้ำ) */
export async function ensureTelegramGrant(userId: string) {
  const existing = await prisma.telegramGrant.findFirst({
    where: { userId, status: { in: ["PENDING", "ADDED"] } },
  });
  if (existing) return;
  await prisma.telegramGrant.create({ data: { userId, status: "PENDING" } });
}

/**
 * ให้ยศ Discord ตามแพ็กเกจ — ทำงานเฉพาะเมื่อตั้งค่าบอทแล้วและสมาชิกผูกบัญชีไว้
 * ห้ามให้ขั้นตอนนี้ทำให้การอนุมัติออเดอร์ล้ม จึงกลืน error ไว้ทั้งหมด
 */
export async function ensureDiscordRole(userId: string, planCode: string) {
  const { discordBotEnabled, syncDiscordRoles } = await import("@/lib/discord");
  if (!discordBotEnabled) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordUserId: true },
  });
  if (!user?.discordUserId) return;

  try {
    await syncDiscordRoles(user.discordUserId, planCode as never);
  } catch {
    // ปล่อยผ่าน แอดมินสั่งให้ยศซ้ำได้จากหน้าแอดมิน
  }
}
