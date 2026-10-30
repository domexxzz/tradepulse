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
import { receiptEmail, expiringSoonEmail, expiredEmail, missingTradingViewEmail } from "@/lib/email-templates";
import {
  sendAdminAlert,
  telegramGroupManaged,
  createMemberInviteLink,
  removeGroupMember,
  isGroupMember,
  revokeInviteLink,
  currentChatId,
  INVITE_DAYS,
} from "@/lib/telegram";
import { formatTHB } from "@/lib/utils";
import { salesPaused } from "@/config/site";
import { sendTelegramInviteEmailWithReason, usersAwaitingInviteEmail } from "@/lib/telegram-invite";

/**
 * เตือนล่วงหน้าที่หลักกี่วันก่อนหมดอายุ — เรียงจากไกลไปใกล้
 *
 * ของเดิมเตือนหลักเดียว 3 วัน ซึ่งน้อยไปสำหรับคนที่ต้องติดต่อแอดมินเพื่อต่ออายุ
 * สามหลักให้โอกาสทักมาก่อนสิทธิ์ดับจริง
 */
export const EXPIRY_REMINDER_DAYS = [7, 3, 1] as const;

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
            expiryNotifiedDays: null, // ล้างหลักที่เคยเตือน ไม่งั้นรอบใหม่จะเงียบ
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
  await clearStaleRevokeQueues(input.userId);
  await ensureAccessGrant(input.userId);
  await ensureTelegramInvite(input.userId);
  await ensureDiscordRole(input.userId, input.planCode);
  await syncTradingViewGrant(input.userId);

  await notifyActivation(input, until);

  return { subscriptionId: sub.id, until, extended: Boolean(canExtendInPlace) };
}

/**
 * ยกเลิกคิว "รอถอนสิทธิ์ / รอนำออกจากกลุ่ม" ที่ค้างจากรอบที่หมดอายุ
 *
 * หมดอายุแล้วบอทถอนไม่สำเร็จ คิวจะค้างที่ PENDING_REVOKE และ reconcile จะสั่งถอนซ้ำ
 * ทุกรอบจนสำเร็จ ถ้าลูกค้าต่ออายุระหว่างนั้น เราเพิ่งสั่งเพิ่มสิทธิ์ให้ แล้ว reconcile
 * รอบถัดไป (ภายใน 10 นาที) จะถอนออกให้เอง — ลูกค้าจ่ายเงินแล้วสิทธิ์หลุดทีหลัง
 * โดยไม่มีใครเห็นว่าเกิดอะไรขึ้น เพราะทั้งสองฝ่ายทำงาน "ถูก" ตามคิวที่มี
 *
 * ฝั่ง Telegram ก็เหมือนกัน PENDING_REMOVE ที่ค้างคือใบสั่งนำคนที่จ่ายเงินแล้วออกจากกลุ่ม
 * ล้างลิงก์เชิญใบเก่าทิ้งด้วย เพราะลิงก์มีอายุ INVITE_DAYS วัน ใบของรอบก่อนใช้ไม่ได้แล้ว
 * ถ้าปล่อยไว้ ensureTelegramInvite จะเห็นว่า "มีลิงก์แล้ว" แล้วข้ามการออกใบใหม่
 */
async function clearStaleRevokeQueues(userId: string): Promise<void> {
  try {
    await prisma.accessGrant.updateMany({
      where: { userId, status: "PENDING_REVOKE" },
      data: { status: "PENDING", revokedAt: null, note: "ต่ออายุแล้ว — ยกเลิกคิวถอนสิทธิ์" },
    });
    await prisma.telegramGrant.updateMany({
      where: { userId, status: "PENDING_REMOVE" },
      data: {
        status: "PENDING",
        removedAt: null,
        inviteLink: null,
        invitedAt: null,
        notifiedAt: null,
        note: "ต่ออายุแล้ว — ยกเลิกคิวนำออกจากกลุ่ม",
      },
    });
  } catch (e) {
    // ล้มเหลวตรงนี้ห้ามทำให้การเปิดสิทธิ์ล้ม — แย่กว่าเดิมไม่ได้ อย่างมากก็เท่าเดิม
    console.error("clear stale revoke queues failed:", e);
  }
}

/** อีเมลใบเสร็จให้สมาชิก + แจ้งแอดมินใน Telegram (ล้มเหลวไม่กระทบการเปิดสิทธิ์) */
async function notifyActivation(input: ActivateInput, until: Date) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      // ensureTelegramInvite รันไปก่อนหน้านี้แล้ว ลิงก์จึงพร้อมใช้ตั้งแต่ตอนนี้
      // แนบมาในใบเสร็จเลย ลูกค้าจะได้ไม่ต้องรอบอทเพิ่มอินดิเคเตอร์เสร็จก่อน
      // (คนที่ยังไม่กรอก TradingView username บอทไม่ได้ทำงานให้ จะไม่มีอีเมลตามมา)
      const tg = await prisma.telegramGrant.findFirst({
        where: { userId: input.userId, status: { in: ["PENDING", "ADDED"] } },
        orderBy: { createdAt: "desc" },
        select: { inviteLink: true },
      });

      const mail = receiptEmail({
        name: user.name,
        planName: planName(input.planCode),
        amountTHB: input.amountTHB,
        until,
        orderId: input.providerRef,
        telegramInviteUrl: tg?.inviteLink ?? null,
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
/**
 * สถานะคิวที่ยัง "มีชีวิต" คือยังรอให้บอททำอะไรสักอย่าง
 *
 * ต้องใช้รายการเดียวกันทุกที่ที่หยิบคิวมาทำงาน (สั่งงาน / ไล่งานค้าง / รับผลกลับ)
 * ถ้าแต่ละที่กรองไม่เหมือนกัน จะหยิบคนละแถวของลูกค้าคนเดียวกัน แล้วตัวนับความล้มเหลว
 * กับเวลารอจะไปอยู่คนละแถวกับแถวที่ถูกสั่งงานจริง ตัวกันทั้งหมดจึงไม่มีผล
 */
export const ACTIVE_GRANT_STATUSES = ["PENDING", "PENDING_REVOKE", "REVOKED"] as const;

/**
 * สถานะที่ syncTradingViewGrant หยิบมาสั่งบอทได้ — ต้องมี GRANTED ด้วย
 *
 * คนที่เคยได้อินดิเคเตอร์แล้วจะเป็น GRANTED ค้างอยู่ ถ้าไม่รวมสถานะนี้
 * ตอนต่ออายุ findFirst จะหาคิวไม่เจอแล้ว return เงียบ ๆ บอทไม่เคยได้รับคำสั่งเลย
 * สิทธิ์บน TradingView จึงยังหมดวันเดิม ลูกค้าจ่ายเงินต่ออายุแล้วถูกตัดสิทธิ์
 * (เจอจริง 30 ต.ค. 69 — 6 รายต่ออายุแล้วไม่ได้อินดิเคเตอร์)
 *
 * บั๊กเดียวกันเคยโดนที่เส้นทางเปลี่ยน username แล้วแก้เฉพาะหน้าด้วยการตั้งคิว
 * กลับเป็น PENDING ก่อนเรียก (api/cron/delivery) — ตรงนั้นรอด แต่เส้นทางต่ออายุไม่ได้ทำ
 * แก้ที่ตัว syncTradingViewGrant เลย เส้นทางใหม่ ๆ จะไม่ต้องจำกลเม็ดนี้อีก
 *
 * ปลอดภัยต่อการวนซ้ำ: reconcile หยิบเฉพาะ PENDING แถว GRANTED จึงไม่ถูกสั่งซ้ำเอง
 */
export const DISPATCHABLE_GRANT_STATUSES = [...ACTIVE_GRANT_STATUSES, "GRANTED"] as const;

export async function syncTradingViewGrant(userId: string, daysOverride?: number): Promise<void> {
  if (!tvAutoGrantEnabled) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tradingViewUsername: true },
    });
    if (!user?.tradingViewUsername) return; // ยังไม่กรอก username — คิวรออยู่แล้ว

    const grant = await prisma.accessGrant.findFirst({
      where: { userId, status: { in: [...DISPATCHABLE_GRANT_STATUSES] } },
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

    /**
     * จดเวลาที่สั่งก่อนยิงเสมอ ไม่ใช่เฉพาะตอนสำเร็จ
     *
     * ของเดิมจดเฉพาะตอนสำเร็จ งานที่ล้มเหลวจึงไม่มีเวลาให้เทียบ reconcile เลยสั่งซ้ำ
     * ทุกรอบ cron (ทุก 5-10 นาที) ถ้างานนั้นไม่มีวันสำเร็จก็วนไม่จบ พร้อมเด้งเตือน
     * แอดมินทุกรอบจนไม่มีใครอ่านแจ้งเตือนอีก (เจอจริง 5 ต.ค. 69 กับ @Kiadthawee)
     */
    await prisma.accessGrant
      .update({ where: { id: grant.id }, data: { lastDispatchedAt: new Date() } })
      .catch(() => {});

    const res = await grantTradingViewAccess(user.tradingViewUsername, days);

    if (res.ok) {
      /**
       * "บอทรับงานเข้าคิว" ไม่ใช่ "บอททำสำเร็จ" — ห้ามล้างตัวนับความล้มเหลวตรงนี้
       *
       * ของเดิมล้าง failCount/lastFailReason ทุกครั้งที่บอทตอบรับงาน ซึ่งบอทตอบรับ
       * เสมอ (Selenium ใช้เวลาเป็นนาที จึงรับเข้าคิวก่อนแล้วค่อยยิงผลกลับ) ผลคือ:
       *   · ตัวนับถูกรีเซ็ตเป็น 0 ก่อนรู้ผล เพดาน MAX_FAILS จึงไม่มีวันถึง
       *   · lastFailReason ถูกล้างเป็น null callback เลยเห็นเป็น "เหตุผลเปลี่ยน" ทุกครั้ง
       *     แล้วเตือนแอดมินซ้ำไม่หยุด
       *   · reconcile เห็น failCount=0 แล้วข้ามเวลารอ สั่งซ้ำทุกรอบ cron
       * (เจอจริง 10 ต.ค. 69 — @Kiadthawee และ @Tradingview201915 วนทุก 15 นาที
       *  ทั้งที่ใส่ทั้งตัวนับและเวลารอไปแล้ว เพราะบรรทัดนี้ล้างทิ้งก่อนเสมอ)
       *
       * ล้างได้เฉพาะตอนสำเร็จจริงเท่านั้น คือตอนบอทตอบผลสำเร็จทันที (ไม่เข้าคิว)
       * หรือตอน callback ยิงผลสำเร็จกลับมา
       */
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: {
          tradingViewUsername: user.tradingViewUsername,
          // จดว่าสั่งไปแล้ว ไม่งั้น reconcile รอบหน้าเห็นเป็น "ยังไม่เคยสั่ง" แล้วสั่งซ้ำ
          // ทั้งที่งานยังนั่งรอในคิวบอทอยู่ — บอทต้องทำคนเดิมสองหน คิวคนอื่นยาวขึ้นฟรี ๆ
          lastDispatchedAt: new Date(),
          ...(res.queued
            ? { note: "ส่งคำสั่งให้บอทแล้ว รอผลยืนยัน" }
            : {
                status: "GRANTED",
                grantedAt: new Date(),
                revokedAt: null,
                note: "ให้สิทธิ์อัตโนมัติโดยบอท",
                failCount: 0,
                lastFailReason: null,
              }),
        },
      });
    } else if (!res.skipped) {
      /**
       * นับครั้งที่ล้มเหลวติดกัน — ใช้หยุดวนซ้ำงานที่ลองอีกกี่ครั้งก็ไม่สำเร็จ
       *
       * แต่ "ติดต่อบอทไม่ได้" ห้ามนับ เพราะเป็นปัญหาของท่อ ไม่ใช่ของงาน
       * บอททำได้ทีละคน ครั้งละ 1-3 นาที ระหว่างนั้น HTTP หมดเวลารอได้เป็นเรื่องปกติ
       * ถ้านับรวม ลูกค้าที่กรอกชื่อถูกต้องจะถูกตัดทิ้งเพราะบอทไม่ว่างตอนนั้น 5 หน
       * แล้วไม่มีใครลองให้อีกเลย — จ่ายเงินแล้วไม่ได้ของโดยที่ไม่มีใครรู้
       * (เจอจริง 10 ต.ค. 69 — @Tradingview201915 โดนนับไป 2 ครั้งทั้งที่บอทยังดีอยู่)
       *
       * ท่อขาดมีตัวเฝ้าของตัวเองอยู่แล้ว (checkBridgeHealth + unreachableSince)
       * ปล่อยให้ reconcile ลองใหม่เรื่อย ๆ จึงถูกต้อง และไม่วนถี่เพราะมีเวลารอคุมอยู่
       */
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: {
          note: `บอทให้สิทธิ์ไม่สำเร็จ: ${res.reason ?? "ไม่ทราบสาเหตุ"}`,
          ...(res.unreachable ? {} : { failCount: { increment: 1 } }),
          lastFailReason: res.reason ?? "ไม่ทราบสาเหตุ",
        },
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
/**
 * ทิ้งลิงก์เชิญที่ออกให้ "กลุ่มอื่น" — คืนค่า true เมื่อทิ้งจริง
 *
 * ลิงก์เชิญผูกกับกลุ่มที่ออกให้ตลอดไป ย้ายกลุ่มเมื่อไหร่ ลิงก์เก่าจะยังพาลูกค้า
 * ไปห้องเดิม และโค้ดเดิมเห็นว่า "มีลิงก์แล้ว" ก็ข้ามไป ไม่ออกใหม่ให้
 * ผลคือลูกค้าที่จ่ายเงินหลังย้ายกลุ่มถูกส่งไปผิดห้องเงียบ ๆ
 * (เกิดจริง 29 ก.ย. 69 — ย้ายจาก TD_SMC ไป QVX SIGNAL)
 *
 * chatId เป็น null คือใบที่ออกก่อนมีช่องนี้ ถือว่าเป็นของกลุ่มเก่าไว้ก่อน —
 * ออกลิงก์ใหม่เสียหายน้อยกว่าส่งลูกค้าไปผิดห้อง
 */
async function dropLinkFromOtherGroup(userId: string): Promise<boolean> {
  const grant = await prisma.telegramGrant.findFirst({
    where: { userId, status: { in: ["PENDING", "ADDED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, inviteLink: true, chatId: true },
  });
  if (!grant?.inviteLink || grant.chatId === currentChatId) return false;

  await revokeInviteLink(grant.inviteLink).catch(() => {
    // ลิงก์อยู่คนละกลุ่มกับที่ตั้งไว้ตอนนี้ Telegram จะปฏิเสธ — คาดไว้แล้ว
  });
  await prisma.telegramGrant.update({
    where: { id: grant.id },
    data: {
      status: "PENDING",
      inviteLink: null,
      invitedAt: null,
      notifiedAt: null,
      telegramUserId: null,
      addedAt: null,
      note: "กลุ่มปลายทางเปลี่ยน — ออกลิงก์ใหม่ให้อัตโนมัติ",
    },
  });
  return true;
}

export async function ensureTelegramInvite(userId: string): Promise<void> {
  await ensureTelegramGrant(userId);

  // ต้องทำก่อนเช็ก telegramGroupManaged — ลิงก์ผิดห้องที่ค้างอยู่ในระบบ
  // อันตรายกว่าไม่มีลิงก์เลย เพราะรอบส่งอีเมลจะหยิบไปส่งให้ลูกค้าได้ทันที
  const dropped = await dropLinkFromOtherGroup(userId);
  if (!telegramGroupManaged) return;

  try {
    const grant = await prisma.telegramGrant.findFirst({
      where: { userId, status: { in: ["PENDING", "ADDED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!grant) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramUserId: true },
    });

    /**
     * ยังอยู่ในกลุ่มจริงหรือไม่ ต้อง "ถามกลุ่ม" ไม่ใช่เชื่อสถานะในฐานข้อมูล
     *
     * ของเดิมเห็น status = ADDED แล้ว return ทันที แต่ ADDED ค้างได้ง่ายมาก:
     * ลูกค้าออกจากกลุ่มเอง หรือถูกนำออกตอนหมดอายุแล้วอัปเดตสถานะไม่ทัน
     * ตอนต่ออายุจึงไม่มีใครออกลิงก์ใหม่ให้ และ reconcile ก็ไม่หยิบ (มันหยิบเฉพาะ
     * PENDING ที่ inviteLink ว่าง) ลูกค้ากลุ่มนี้จึงค้างถาวรจนกว่าจะทักมาเอง
     * (เจอจริง 30 ต.ค. 69 — ต่ออายุแล้วไม่ได้เข้ากลุ่ม 2 ราย)
     *
     * isGroupMember ถามไม่ได้ก็ตอบ false อยู่แล้ว อย่างแย่สุดคือออกลิงก์เกินมาใบหนึ่ง
     * ซึ่งเสียหายน้อยกว่าปล่อยให้คนจ่ายเงินแล้วเข้ากลุ่มไม่ได้
     */
    const stillMember =
      Boolean(user?.telegramUserId) && (await isGroupMember(user!.telegramUserId!));

    if (stillMember) {
      if (grant.status !== "ADDED" || grant.telegramUserId !== user!.telegramUserId) {
        await prisma.telegramGrant.update({
          where: { id: grant.id },
          data: {
            status: "ADDED",
            addedAt: new Date(),
            telegramUserId: user!.telegramUserId,
            note: "ยังอยู่ในกลุ่มจากรอบก่อน",
          },
        });
      }
      return;
    }

    /**
     * ลิงก์เชิญที่ออกไว้มีอายุแค่ INVITE_DAYS วัน ใบของรอบก่อนจึงตายไปแล้ว
     * ต้องนับว่า "ไม่มีลิงก์" ไม่ใช่ "มีลิงก์แล้วข้ามไป" ไม่งั้นลูกค้าได้ลิงก์ที่กดไม่ได้
     * ใบที่ยังไม่หมดอายุไม่ต้องออกใหม่ — ออกใหม่ทุกรอบจะทำให้ใบที่ส่งอีเมลไปแล้วใช้ไม่ได้
     */
    const linkAlive =
      Boolean(grant.inviteLink) &&
      grant.invitedAt !== null &&
      grant.invitedAt.getTime() > Date.now() - INVITE_DAYS * 24 * 60 * 60 * 1000;
    if (!dropped && linkAlive) return;

    const inviteLink = await createMemberInviteLink(grant.id);
    await prisma.telegramGrant.update({
      where: { id: grant.id },
      // เก็บกลุ่มที่ออกให้ไว้ด้วย รอบหน้าจะได้รู้ว่าลิงก์ใบนี้ของกลุ่มไหน
      //
      // ล้าง notifiedAt ทุกครั้งที่ออกใบใหม่ — รอบกวาดรายวันส่งอีเมลเฉพาะแถวที่
      // notifiedAt ว่าง ถ้าไม่ล้าง ใบใหม่จะนอนอยู่ในฐานข้อมูลโดยไม่มีใครส่งให้ลูกค้า
      // เพราะระบบจำว่า "ส่งลิงก์ไปแล้ว" ตั้งแต่ใบที่ตายไปแล้วของรอบก่อน
      data: {
        inviteLink,
        chatId: currentChatId,
        invitedAt: new Date(),
        notifiedAt: null,
        note: "ลิงก์เชิญส่วนตัวพร้อมใช้งาน",
      },
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

/**
 * ส่งอีเมลเตือนใกล้หมดอายุ — หลักละครั้งต่อรอบบิล (7 / 3 / 1 วัน)
 *
 * expiryNotifiedDays เก็บหลักที่เล็กที่สุดที่ส่งไปแล้ว ถ้าไม่เก็บ cron จะยิงซ้ำทุกครั้งที่รัน
 * คนเหลือ 2 วันจะได้อีเมลวันละหลายฉบับจนรำคาญแล้วกดสแปม
 */
async function remindExpiring(sub: Subscription): Promise<boolean> {
  if (!sub.currentPeriodEnd) return false;

  const daysLeft = Math.max(1, daysUntil(sub.currentPeriodEnd));
  // หลักที่ควรส่งตอนนี้ = หลักเล็กสุดที่ยังครอบ daysLeft อยู่
  const due = EXPIRY_REMINDER_DAYS.filter((d) => daysLeft <= d).sort((a, b) => a - b)[0];
  if (due === undefined) return false;
  // เคยส่งหลักนี้หรือหลักที่ใกล้กว่าไปแล้ว
  if (sub.expiryNotifiedDays !== null && sub.expiryNotifiedDays <= due) return false;

  const user = await prisma.user.findUnique({
    where: { id: sub.userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return false;

  const mail = expiringSoonEmail({
    name: user.name,
    planName: planName(sub.planCode),
    until: sub.currentPeriodEnd,
    daysLeft,
    salesPaused,
  });

  const res = await sendEmail({ to: user.email, ...mail });
  // ส่งไม่ออกเพราะยังไม่ตั้งค่าอีเมล — อย่าเพิ่งประทับว่าเตือนแล้ว จะได้เตือนได้เมื่อเปิดระบบอีเมล
  if (!res.ok) return false;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { expiryNotifiedAt: new Date(), expiryNotifiedDays: due },
  });
  return true;
}

export interface MaintenanceResult {
  expired: number;
  reminded: number;
  /** ทวงคนที่จ่ายแล้วแต่ยังไม่กรอก TradingView username ไปกี่ราย */
  tvReminded: number;
  /** ยังไม่กรอกทั้งหมดกี่ราย — "ทวง 0" อาจแปลว่ายังไม่ถึงรอบทวง ไม่ใช่ไม่มีใครค้าง */
  tvPending: number;
  /** ส่งลิงก์กลุ่ม Telegram ให้คนที่ตกหล่นไปกี่ราย */
  invited: number;
  /** ควรได้ลิงก์แต่ส่งไม่สำเร็จกี่ราย — ต้องมีคนไปดู ไม่ใช่ปล่อยให้ค้าง */
  stuck: number;
  /** ส่งไม่สำเร็จเพราะอะไรบ้าง — บอกว่าต้องไปแก้ที่บอทหรือที่ระบบอีเมล */
  reasons: Record<string, number>;
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

  // ดึงทุกคนที่เข้าหลักไกลสุด แล้วค่อยตัดสินทีละคนว่าถึงหลักไหนแล้ว
  const widest = Math.max(...EXPIRY_REMINDER_DAYS);
  const soonEnd = new Date(now.getTime() + widest * 24 * 60 * 60 * 1000);
  const expiring = await prisma.subscription.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
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

  const invite = await inviteMissedMembers();
  const tv = await remindMissingTradingView();

  if (due.length > 0 || reminded > 0 || invite.sent > 0 || invite.stuck.length > 0 || tv.sent > 0 || tv.pending > 0) {
    await sendAdminAlert(
      `🕐 งานประจำวันสมาชิก
ปิดสิทธิ์ (หมดอายุ): ${due.length} ราย
เตือนใกล้หมดอายุ: ${reminded} ราย
ยังไม่กรอกชื่อ TradingView: ${tv.pending} ราย (ทวงรอบนี้ ${tv.sent})
ส่งลิงก์กลุ่มที่ตกหล่น: ${invite.sent} ราย` +
        (invite.stuck.length > 0
          ? `\n⚠️ ส่งลิงก์ไม่สำเร็จ ${invite.stuck.length} ราย (${describeReasons(invite.reasons)})\nดูที่ /admin/telegram`
          : "") +
        (due.length > 0 ? "\nตรวจคิวถอนสิทธิ์ที่ /admin/access-queue และ /admin/telegram" : "")
    );
  }

  return {
    expired: due.length,
    reminded,
    tvReminded: tv.sent,
    tvPending: tv.pending,
    invited: invite.sent,
    stuck: invite.stuck.length,
    reasons: invite.reasons,
    checkedAt: now.toISOString(),
  };
}

/** ทวงครั้งแรกหลังเปิดใช้งาน 1 วัน แล้วย้ำทุก 3 วัน สูงสุด 4 ครั้ง */
const TV_REMIND_FIRST_HOURS = 24;
const TV_REMIND_EVERY_DAYS = 3;
const TV_REMIND_MAX = 4;

/**
 * ทวงคนที่จ่ายเงินแล้วแต่ยังไม่ได้กรอก TradingView username
 *
 * เป็นขั้นตอนเดียวในระบบที่ทำแทนลูกค้าไม่ได้ — ไม่กรอกคือจ่ายเงินแล้วไม่ได้ของ
 * ของเดิมไม่มีอะไรไปทวงเลย มีแต่บรรทัดเดียวกลางอีเมลใบเสร็จ คนเลยหลุดค้างเป็นเดือน
 * (30 ก.ย. 69 ค้างอยู่ 5 คน ต้องให้คนไปไล่ทวงทาง LINE ทีละคน)
 *
 * หยุดทวงเมื่อครบ TV_REMIND_MAX ครั้ง — เลยจากนั้นถือว่าต้องใช้คนคุยแล้ว
 * ทวงต่อมีแต่จะโดนกดสแปม แล้วอีเมลอื่นของเราจะพลอยเข้า junk ไปด้วย
 */
export async function remindMissingTradingView(
  now = new Date()
): Promise<{ sent: number; pending: number }> {
  const firstDue = new Date(now.getTime() - TV_REMIND_FIRST_HOURS * 60 * 60 * 1000);
  const nextDue = new Date(now.getTime() - TV_REMIND_EVERY_DAYS * 24 * 60 * 60 * 1000);

  // ยังไม่กรอกทั้งหมดกี่คน — ไม่สนเงื่อนไขเว้นจังหวะ
  // แยกจากจำนวนที่ทวงรอบนี้ เพราะ "ทวง 0" มีสองความหมาย คือไม่มีใครค้าง
  // กับ มีคนค้างแต่ยังไม่ถึงรอบทวง ถ้าไม่แยกจะอ่านผิดว่าระบบทวงพัง
  const pending = await prisma.subscription.count({
    where: {
      status: { in: ACTIVE_STATUSES },
      currentPeriodEnd: { gt: now },
      user: { tradingViewUsername: null },
    },
  });

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      currentPeriodEnd: { gt: now },
      // เปิดใช้งานมาอย่างน้อย 1 วัน — เพิ่งจ่ายเสร็จยังไม่ต้องทวง เขากำลังทำอยู่
      createdAt: { lt: firstDue },
      user: {
        tradingViewUsername: null,
        email: { not: null },
        tvRemindCount: { lt: TV_REMIND_MAX },
        OR: [{ tvRemindedAt: null }, { tvRemindedAt: { lt: nextDue } }],
      },
    },
    include: { user: { select: { id: true, email: true, name: true } } },
    take: 200,
  });

  let sent = 0;
  for (const sub of subs) {
    if (!sub.user.email || !sub.currentPeriodEnd) continue;
    try {
      const mail = missingTradingViewEmail({
        name: sub.user.name,
        planName: planName(sub.planCode),
        until: sub.currentPeriodEnd,
      });
      const res = await sendEmail({ to: sub.user.email, ...mail });
      // ส่งไม่ออกเพราะระบบอีเมลยังไม่พร้อม — อย่าเพิ่งนับว่าทวงแล้ว
      if (!res.ok) continue;
      await prisma.user.update({
        where: { id: sub.user.id },
        data: { tvRemindedAt: now, tvRemindCount: { increment: 1 } },
      });
      sent += 1;
    } catch (e) {
      console.error("tv username reminder failed for", sub.user.id, e);
    }
  }
  return { sent, pending };
}

/**
 * ส่งลิงก์กลุ่ม Telegram ให้สมาชิกที่จ่ายเงินและได้รับอนุมัติแล้ว แต่ลิงก์ไม่ถึงมือ
 *
 * ทำไมต้องมี: จ่ายเงิน + แอดมินอนุมัติ = ได้สิทธิ์แล้ว ลิงก์ควรถึงมือเองไม่ต้องรอใครกด
 * แต่การส่งตอนอนุมัติพลาดได้หลายทาง — SMTP ล่มชั่วคราว, บอทสร้างลิงก์ไม่ทัน,
 * หรือได้สิทธิ์มาก่อนที่ระบบจะมีอีเมลฉบับนี้ (สมาชิกชุดแรกเข้าข่ายข้อนี้ทั้งหมด)
 * ก่อนหน้านี้ต้องให้แอดมินไปกดปุ่มส่งเองทีละคน ซึ่งไม่มีใครรู้ว่าต้องไปกด
 *
 * รอบนี้จึงไล่หาคนที่สิทธิ์ยังใช้งานได้แต่ notifiedAt ยังว่าง แล้วส่งให้
 * นับแค่ status PENDING — ที่เป็น ADDED คือเข้ากลุ่มไปแล้ว ไม่ต้องส่งอะไรอีก
 */
/** แปลสาเหตุเป็นภาษาคน — แอดมินอ่านแล้วรู้เลยว่าต้องไปแก้ที่ไหน */
function describeReasons(reasons: Record<string, number>): string {
  const label: Record<string, string> = {
    "no-link": "บอทสร้างลิงก์เชิญไม่ได้",
    "mail-failed": "ระบบอีเมลส่งไม่ออก",
    "no-email": "สมาชิกไม่มีอีเมล",
    threw: "เกิดข้อผิดพลาด",
  };
  return (
    Object.entries(reasons)
      .filter(([k]) => k !== "sent")
      .map(([k, n]) => `${label[k] ?? k} ${n}`)
      .join(" · ") || "ไม่ทราบสาเหตุ"
  );
}

export interface InviteSweepResult {
  sent: number;
  /**
   * คนที่ควรได้ลิงก์แต่ส่งไม่สำเร็จ — เช่นบอทสร้างลิงก์เชิญไม่ได้ หรืออีเมลส่งไม่ออก
   *
   * ต้องรายงานออกมา ไม่ใช่เงียบ ๆ ไม่งั้นคนกลุ่มนี้จะถูกนับบนหน้าแอดมินทุกวัน
   * โดยไม่มีใครรู้ว่าทำไมตัวเลขไม่ลด แล้วแอดมินจะกดปุ่มซ้ำไปเรื่อย ๆ เปล่า ๆ
   */
  stuck: string[];
  /** นับตามสาเหตุ เช่น { "no-link": 3, "mail-failed": 4 } — บอกว่าต้องไปแก้ที่ไหน */
  reasons: Record<string, number>;
}

/** เรียกจาก cron รายวัน และจากปุ่มในหน้า /admin/telegram เมื่ออยากส่งเลยไม่รอถึงรอบ */
export async function inviteMissedMembers(): Promise<InviteSweepResult> {
  const waiting = await usersAwaitingInviteEmail();

  let sent = 0;
  const stuck: string[] = [];
  const reasons: Record<string, number> = {};
  for (const userId of waiting) {
    try {
      // ยังไม่มีลิงก์ก็สร้างให้ก่อน (เช่นตอนอนุมัติ บอทสร้างไม่ทัน)
      await ensureTelegramInvite(userId);
      const r = await sendTelegramInviteEmailWithReason(userId);
      reasons[r] = (reasons[r] ?? 0) + 1;
      if (r === "sent") sent += 1;
      else stuck.push(userId);
    } catch (e) {
      console.error("invite backfill failed for", userId, e);
      reasons.threw = (reasons.threw ?? 0) + 1;
      stuck.push(userId);
    }
  }
  return { sent, stuck, reasons };
}

/** ใช้ตอนแอดมินสั่งปิดสิทธิ์เอง (ไม่รอ cron) */
export async function expireSubscriptionById(subscriptionId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (sub) await expireSubscription(sub);
}

export type { PlanInterval };
