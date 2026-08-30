/**
 * วงจรชีวิตสมาชิก — เปิดสิทธิ์ ต่ออายุ เตือนก่อนหมด และปิดสิทธิ์เมื่อหมดอายุ
 *
 * รวมไว้ที่เดียวเพราะทุกช่องทาง (สลิป QR, Stripe, แอดมินสั่งมือ, cron) ต้องได้ผลลัพธ์เหมือนกัน
 * ถ้าแยกกันเขียนจะหลุดบางขั้นตอนแน่นอน — เช่นเปิดสิทธิ์แล้วลืมให้ยศ Discord
 */
import { prisma } from "@/lib/prisma";
import { lockPromoPriceIfEligible } from "@/lib/pricing";
import type { Subscription } from "@prisma/client";
import { plans, type PlanInterval } from "@/config/plans";
import { addMonths, daysUntil, formatThaiDate } from "@/lib/date";
import { isSubscriptionActive, ACTIVE_STATUSES, getUserSubscription } from "@/lib/subscription";
import { recordPayment, ensureAccessGrant, ensureTelegramGrant, ensureDiscordRole } from "@/lib/fulfillment";
import { grantTradingViewAccess, revokeTradingViewAccess, tvAutoGrantEnabled } from "@/lib/tradingview";
import { sendEmail } from "@/lib/email";
import { receiptEmail, expiringSoonEmail, expiredEmail } from "@/lib/email-templates";
import {
  sendAdminAlert,
  telegramGroupManaged,
  createMemberInviteLink,
  removeGroupMember,
  isGroupMember,
} from "@/lib/telegram";
import { formatTHB } from "@/lib/utils";

/** เตือนล่วงหน้ากี่วันก่อนหมดอายุ */
export const EXPIRY_REMINDER_DAYS = 3;

/** ไม่มีวันหมดอายุของแพ็กเกจให้ยึด = ให้เท่าสเปคขั้นต่ำ 1 เดือน (ห้ามให้บอทเพิ่มแบบไม่จำกัดวัน) */
const DEFAULT_GRANT_DAYS = 30;

const planName = (code: string) => plans.find((p) => p.id === code)?.name ?? code;

/* ------------------------------------------------------------------ */
/* เปิด / ต่ออายุสิทธิ์                                                 */
/* ------------------------------------------------------------------ */

export interface ActivateInput {
  userId: string;
  planCode: string;
  amountTHB: number;
  /** เลขอ้างอิงการชำระเงิน ใช้กันบันทึกซ้ำ */
  providerRef: string;
  /** ที่มาของการเปิดสิทธิ์ ใช้ในข้อความแจ้งแอดมิน */
  source?: string;
  /** ช่องทางที่ได้เงินมา — เก็บลงใบเสร็จเพื่อดูว่าช่องทางไหนขายดี */
  provider?: string;
}

export interface ActivateResult {
  subscriptionId: string;
  until: Date;
  /** true = ต่ออายุจากของเดิม (ทบวันที่เหลือให้), false = เปิดใหม่ */
  extended: boolean;
}

/**
 * เปิดหรือต่ออายุแพ็กเกจให้สมาชิก แล้วเปิดสิทธิ์ทุกช่องทางให้ครบ
 *
 * ต่ออายุก่อนหมดวัน จะนับต่อจาก "วันหมดอายุเดิม" ไม่ใช่วันนี้
 * ไม่งั้นคนที่ต่อล่วงหน้าจะเสียวันที่เหลือฟรี ซึ่งเป็นเหตุผลให้ลูกค้ารอจนหมดอายุค่อยต่อ
 */
export async function activateMembership(input: ActivateInput): Promise<ActivateResult> {
  const plan = plans.find((p) => p.id === input.planCode);
  const months = plan?.months ?? 1;
  const now = new Date();

  const current = await prisma.subscription.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" },
  });

  const stillActive = isSubscriptionActive(current, now);
  const base = stillActive && current?.currentPeriodEnd ? current.currentPeriodEnd : now;
  const until = addMonths(base, months);

  // ต่ออายุแพ็กเกจ QR เดิมได้ในแถวเดียว — แต่แพ็กเกจของ Stripe ต้องปล่อยให้ webhook คุมรอบบิลเอง
  const canExtendInPlace = stillActive && current && !current.stripeSubscriptionId;

  // เปิดสิทธิ์กับบันทึกใบเสร็จต้องอยู่ใน transaction เดียว: ถ้าขาดตอนกลาง
  // จะได้สมาชิกที่ใช้งานได้แต่ไม่มีใบเสร็จ (รายได้หาย ที่นั่งโปรนับผิด) โดยไม่มีใครรู้
  // ส่วนบริการภายนอก (Telegram/Discord/TradingView/อีเมล) และการล็อกราคาโปร
  // ต้องอยู่ "นอก" transaction — มันช้าและล้มเหลวได้ ไม่ควรลากให้ทั้งก้อน rollback
  // (ล็อกราคาโปรนับจาก Payment จึงต้องรอให้ commit ก่อน)
  const sub = await prisma.$transaction(async (tx) => {
    const s = canExtendInPlace
      ? await tx.subscription.update({
          where: { id: current.id },
          data: {
            planCode: input.planCode,
            status: "ACTIVE",
            currentPeriodEnd: until,
            expiredAt: null,
            expiryNotifiedAt: null, // รอบใหม่ต้องเตือนได้อีกครั้ง
          },
        })
      : await tx.subscription.create({
          data: {
            userId: input.userId,
            planCode: input.planCode,
            status: "ACTIVE",
            currentPeriodEnd: until,
          },
        });

    // แถมสิทธิ์ให้ฟรี (0 บาท) ไม่ต้องบันทึกเป็นรายได้
    if (input.amountTHB > 0) {
      await recordPayment(input.userId, input.amountTHB, input.providerRef, input.provider, tx);
    }
    return s;
  });

  // จ่ายเงินจริงแล้วถึงจะกินที่นั่งโปรและได้ล็อกราคา — ของแถม 0 บาทไม่นับ
  // อยู่นอก transaction เพราะนับจาก Payment ที่เพิ่ง commit ไป และล้มได้โดยไม่ควรย้อนการเปิดสิทธิ์
  if (input.amountTHB > 0) {
    await lockPromoPriceIfEligible(input.userId);
  }
  await ensureAccessGrant(input.userId);
  await ensureTelegramInvite(input.userId);
  await ensureDiscordRole(input.userId, input.planCode);
  await syncTradingViewGrant(input.userId);

  await notifyActivation(input, until);

  return { subscriptionId: sub.id, until, extended: Boolean(canExtendInPlace) };
}

/** อีเมลใบเสร็จให้สมาชิก + แจ้งแอดมินใน Telegram (ล้มเหลวไม่กระทบการเปิดสิทธิ์) */
async function notifyActivation(input: ActivateInput, until: Date) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const mail = receiptEmail({
        name: user.name,
        planName: planName(input.planCode),
        amountTHB: input.amountTHB,
        until,
        orderId: input.providerRef,
      });
      await sendEmail({ to: user.email, ...mail });
    }

    await sendAdminAlert(
      `✅ เปิดสิทธิ์แล้ว
สมาชิก: ${user?.name ?? user?.email ?? input.userId}
แพ็ก: ${planName(input.planCode)} · ${formatTHB(input.amountTHB)}
ใช้ได้ถึง: ${formatThaiDate(until)}${input.source ? `\nช่องทาง: ${input.source}` : ""}`
    );
  } catch (e) {
    console.error("activation notify failed:", e);
  }
}

/**
 * ให้สิทธิ์ TradingView อัตโนมัติถ้าตั้งบอทไว้แล้ว
 *
 * บอทตอบกลับแค่ว่า "รับงานเข้าคิวแล้ว" (Selenium ใช้เวลาเป็นนาที) เราจึงยังไม่ปิดคิว
 * ที่นี่ — สถานะจะถูกเปลี่ยนเป็น GRANTED ตอนบอทยิงผลกลับมาที่ /api/tradingview/callback
 * ระหว่างนั้นรายการยังค้างในคิวให้แอดมินเห็น เผื่อบอทเงียบหายไปเลย
 *
 * ไม่สำเร็จก็ปล่อยให้คิวค้างไว้ให้แอดมินกดเอง — ห้าม throw
 */
export async function syncTradingViewGrant(userId: string, daysOverride?: number): Promise<void> {
  if (!tvAutoGrantEnabled) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tradingViewUsername: true },
    });
    if (!user?.tradingViewUsername) return; // ยังไม่กรอก username — คิวรออยู่แล้ว

    const grant = await prisma.accessGrant.findFirst({
      where: { userId, status: { in: ["PENDING", "PENDING_REVOKE", "REVOKED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!grant) return;

    // ให้สิทธิ์บน TradingView หมดอายุพร้อมแพ็กเกจ เผื่อ cron ฝั่งเราไม่ทำงานสักวัน
    const { sub, isActive } = await getUserSubscription(userId);
    // แอดมินเลือกจำนวนวันเองได้ (daysOverride) — ไม่งั้นยึดตามวันหมดอายุแพ็กเกจ
    // ไม่มีแพ็กเกจให้ยึดก็ยังต้องส่งจำนวนวันไป ห้ามปล่อยให้บอทเพิ่มแบบไม่มีวันหมดอายุ
    const days =
      daysOverride && daysOverride > 0
        ? daysOverride
        : isActive && sub?.currentPeriodEnd
          ? Math.max(1, daysUntil(sub.currentPeriodEnd))
          : DEFAULT_GRANT_DAYS;

    const res = await grantTradingViewAccess(user.tradingViewUsername, days);

    if (res.ok) {
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: {
          tradingViewUsername: user.tradingViewUsername,
          ...(res.queued
            ? { note: "ส่งคำสั่งให้บอทแล้ว รอผลยืนยัน" }
            : { status: "GRANTED", grantedAt: new Date(), revokedAt: null, note: "ให้สิทธิ์อัตโนมัติโดยบอท" }),
        },
      });
    } else if (!res.skipped) {
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: { note: `บอทให้สิทธิ์ไม่สำเร็จ: ${res.reason ?? "ไม่ทราบสาเหตุ"}` },
      });
    }
  } catch (e) {
    console.error("tradingview auto-grant failed:", e);
  }
}

/**
 * เตรียมสิทธิ์กลุ่ม Telegram ให้สมาชิก
 *
 * ยังไม่ตั้งบอท/กลุ่ม = เข้าคิวให้แอดมินเพิ่มเข้ากลุ่มเองเหมือนเดิม
 * ตั้งแล้ว = สร้างลิงก์เชิญส่วนตัวที่ใช้ได้ครั้งเดียวให้ (สมาชิกกดเองในหน้าบัญชี)
 *
 * คนที่ยังอยู่ในกลุ่มจากรอบก่อนไม่ต้องได้ลิงก์ใหม่ — ปิดคิวให้เลย
 * ห้าม throw: Telegram ล่มไม่ควรทำให้การเปิดสิทธิ์ทั้งก้อนล้ม
 */
export async function ensureTelegramInvite(userId: string): Promise<void> {
  await ensureTelegramGrant(userId);
  if (!telegramGroupManaged) return;

  try {
    const grant = await prisma.telegramGrant.findFirst({
      where: { userId, status: { in: ["PENDING", "ADDED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!grant || grant.status === "ADDED" || grant.inviteLink) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramUserId: true },
    });

    if (user?.telegramUserId && (await isGroupMember(user.telegramUserId))) {
      await prisma.telegramGrant.update({
        where: { id: grant.id },
        data: {
          status: "ADDED",
          addedAt: new Date(),
          telegramUserId: user.telegramUserId,
          note: "ยังอยู่ในกลุ่มจากรอบก่อน",
        },
      });
      return;
    }

    const inviteLink = await createMemberInviteLink(grant.id);
    await prisma.telegramGrant.update({
      where: { id: grant.id },
      data: { inviteLink, invitedAt: new Date(), note: "ลิงก์เชิญส่วนตัวพร้อมใช้งาน" },
    });
  } catch (e) {
    console.error("telegram invite failed:", e);
  }
}

/* ------------------------------------------------------------------ */
/* ปิดสิทธิ์เมื่อหมดอายุ                                                */
/* ------------------------------------------------------------------ */

/**
 * ปิดสิทธิ์ของแพ็กเกจที่ครบกำหนด
 * ทุกขั้นตอนแยก try/catch เพราะบริการภายนอกล่มหนึ่งตัว ไม่ควรทำให้ตัวอื่นไม่ถูกปิด
 */
export async function expireSubscription(sub: Subscription): Promise<void> {
  const now = new Date();

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "EXPIRED", expiredAt: now },
  });

  const user = await prisma.user.findUnique({
    where: { id: sub.userId },
    select: {
      email: true,
      name: true,
      discordUserId: true,
      tradingViewUsername: true,
      telegramUserId: true,
    },
  });

  // 1) TradingView — ถอนอัตโนมัติถ้ามีบอท ไม่งั้นเข้าคิวให้แอดมินถอนเอง
  try {
    const auto =
      tvAutoGrantEnabled && user?.tradingViewUsername
        ? await revokeTradingViewAccess(user.tradingViewUsername)
        : { ok: false, skipped: true as const, queued: false };

    // ถอนสำเร็จทันทีค่อยปิดคิว — ถ้าบอทแค่รับงานเข้าคิว ยังต้องรอ callback ยืนยัน
    const done = auto.ok && !("queued" in auto && auto.queued);

    await prisma.accessGrant.updateMany({
      where: { userId: sub.userId, status: { in: ["PENDING", "GRANTED"] } },
      data: done
        ? { status: "REVOKED", revokedAt: now, note: "ถอนสิทธิ์อัตโนมัติ (หมดอายุ)" }
        : {
            status: "PENDING_REVOKE",
            note: auto.ok
              ? "หมดอายุ — ส่งคำสั่งถอนให้บอทแล้ว รอผลยืนยัน"
              : "หมดอายุ — รอแอดมินถอนสิทธิ์บน TradingView",
          },
    });
  } catch (e) {
    console.error("expire: tradingview step failed:", e);
  }

  // 2) Discord — ถอนยศทั้งหมดที่ระบบดูแล
  try {
    if (user?.discordUserId) {
      const { discordBotEnabled, revokeDiscordRoles } = await import("@/lib/discord");
      if (discordBotEnabled) await revokeDiscordRoles(user.discordUserId);
    }
  } catch (e) {
    console.error("expire: discord step failed:", e);
  }

  // 3) Telegram — นำออกอัตโนมัติถ้ารู้ว่าเป็นใครในกลุ่ม ไม่งั้นเข้าคิวให้แอดมิน
  try {
    let removed = false;
    if (telegramGroupManaged && user?.telegramUserId) {
      try {
        await removeGroupMember(user.telegramUserId);
        removed = true;
      } catch (e) {
        console.error("expire: telegram kick failed:", e);
      }
    }

    await prisma.telegramGrant.updateMany({
      where: { userId: sub.userId, status: { in: ["PENDING", "ADDED"] } },
      data: removed
        ? { status: "REMOVED", removedAt: now, note: "นำออกจากกลุ่มอัตโนมัติ (หมดอายุ)" }
        : { status: "PENDING_REMOVE", note: "หมดอายุ — รอนำออกจากกลุ่ม" },
    });
  } catch (e) {
    console.error("expire: telegram step failed:", e);
  }

  // 4) แจ้งสมาชิก
  try {
    if (user?.email) {
      const mail = expiredEmail({ name: user.name, planName: planName(sub.planCode) });
      await sendEmail({ to: user.email, ...mail });
    }
  } catch (e) {
    console.error("expire: email step failed:", e);
  }
}

/** ส่งอีเมลเตือนใกล้หมดอายุ (ครั้งเดียวต่อรอบบิล) */
async function remindExpiring(sub: Subscription): Promise<boolean> {
  if (!sub.currentPeriodEnd) return false;

  const user = await prisma.user.findUnique({
    where: { id: sub.userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return false;

  const mail = expiringSoonEmail({
    name: user.name,
    planName: planName(sub.planCode),
    until: sub.currentPeriodEnd,
    daysLeft: Math.max(1, daysUntil(sub.currentPeriodEnd)),
  });

  const res = await sendEmail({ to: user.email, ...mail });
  // ส่งไม่ออกเพราะยังไม่ตั้งค่าอีเมล — อย่าเพิ่งประทับว่าเตือนแล้ว จะได้เตือนได้เมื่อเปิดระบบอีเมล
  if (!res.ok) return false;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { expiryNotifiedAt: new Date() },
  });
  return true;
}

export interface MaintenanceResult {
  expired: number;
  reminded: number;
  checkedAt: string;
}

/**
 * งานประจำวัน — เรียกจาก /api/cron/expire
 *
 * ดูเฉพาะแพ็กเกจที่ระบบเราคุมรอบบิลเอง (ไม่มี stripeSubscriptionId)
 * ของ Stripe ปล่อยให้ webhook เป็นคนอัปเดตสถานะ ไม่งั้นจะชนกันเอง
 */
export async function runMembershipMaintenance(): Promise<MaintenanceResult> {
  const now = new Date();

  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      stripeSubscriptionId: null,
      currentPeriodEnd: { lt: now },
    },
    take: 500,
  });

  for (const sub of due) {
    try {
      await expireSubscription(sub);
    } catch (e) {
      console.error("expire failed for", sub.id, e);
    }
  }

  const soonEnd = new Date(now.getTime() + EXPIRY_REMINDER_DAYS * 24 * 60 * 60 * 1000);
  const expiring = await prisma.subscription.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      expiryNotifiedAt: null,
      currentPeriodEnd: { gte: now, lte: soonEnd },
    },
    take: 500,
  });

  let reminded = 0;
  for (const sub of expiring) {
    try {
      if (await remindExpiring(sub)) reminded += 1;
    } catch (e) {
      console.error("reminder failed for", sub.id, e);
    }
  }

  if (due.length > 0 || reminded > 0) {
    await sendAdminAlert(
      `🕐 งานประจำวันสมาชิก
ปิดสิทธิ์ (หมดอายุ): ${due.length} ราย
เตือนใกล้หมดอายุ: ${reminded} ราย${due.length > 0 ? "\nตรวจคิวถอนสิทธิ์ที่ /admin/access-queue และ /admin/telegram" : ""}`
    );
  }

  return { expired: due.length, reminded, checkedAt: now.toISOString() };
}

/** ใช้ตอนแอดมินสั่งปิดสิทธิ์เอง (ไม่รอ cron) */
export async function expireSubscriptionById(subscriptionId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (sub) await expireSubscription(sub);
}

export type { PlanInterval };
