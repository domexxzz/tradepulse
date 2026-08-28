import { prisma } from "@/lib/prisma";
import { syncTradingViewGrant, ensureTelegramInvite } from "@/lib/lifecycle";
import { revokeTradingViewAccess, tvAutoGrantEnabled } from "@/lib/tradingview";
import { telegramGroupManaged } from "@/lib/telegram";
import { ACTIVE_STATUSES } from "@/lib/subscription";

/**
 * ตัวไล่งานค้าง — หัวใจของโหมดอัตโนมัติ
 *
 * ปัญหาที่แก้: เว็บสั่งบอทแบบยิงแล้วปล่อย ถ้าบริดจ์ล่มพอดีตอนลูกค้าจ่ายเงิน
 * คิวจะค้างที่ PENDING แล้วไม่มีอะไรมาทำต่อ — ลูกค้ารอจนกว่าแอดมินจะเปิดหน้าคิวเห็น
 * ตัวนี้กวาดงานที่ค้างเป็นรอบ ๆ แล้วสั่งซ้ำให้เอง
 *
 * ออกแบบให้ปลอดภัยต่อการเรียกซ้ำ:
 *   - รอ GRACE_MINUTES ก่อนแตะ เพื่อไม่ไปชนกับงานที่บอทกำลังทำอยู่
 *     (บอทใช้เวลา 1-3 นาทีต่อคิว การสั่งซ้ำระหว่างนั้นจะได้คิวซ้อน)
 *   - จำกัดจำนวนต่อรอบ กัน serverless หมดเวลาแล้วงานค้างครึ่งทาง
 *   - ทุกงานหุ้ม try เดี่ยว งานหนึ่งพังไม่ลากงานที่เหลือ
 */

/** ต้องค้างนานกว่านี้ถึงจะถือว่า "ไม่มีใครทำ" ไม่ใช่ "กำลังทำอยู่" */
const GRACE_MINUTES = 10;

/** เพดานต่อรอบ — cron วิ่งถี่อยู่แล้ว ค่อย ๆ เก็บดีกว่าหมดเวลากลางทาง */
const MAX_PER_RUN = 15;

export interface ReconcileResult {
  /** คิวให้สิทธิ์ที่สั่งบอทซ้ำ */
  grantsRetried: number;
  /** คิวถอนสิทธิ์ที่ค้างแล้วสั่งซ้ำ */
  revokesRetried: number;
  /** ลิงก์เชิญ Telegram ที่สร้างย้อนหลังให้ */
  invitesCreated: number;
  /** คิวที่รอลูกค้ากรอก username — ไม่ใช่ความผิดพลาดของระบบ แต่ควรรู้จำนวน */
  waitingForUsername: number;
  skipped?: string;
}

/**
 * คิวให้สิทธิ์ที่ค้าง: PENDING + มี username + แพ็กเกจยังใช้งานอยู่
 *
 * เงื่อนไข "แพ็กเกจยังใช้งานอยู่" สำคัญมาก — ไม่งั้นคิวเก่าของคนที่หมดอายุไปแล้ว
 * จะถูกปลุกขึ้นมาให้สิทธิ์ใหม่เรื่อย ๆ
 */
async function retryPendingGrants(cutoff: Date): Promise<number> {
  const stuck = await prisma.accessGrant.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      user: {
        tradingViewUsername: { not: null },
        subscriptions: {
          some: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gt: new Date() } },
        },
      },
    },
    select: { id: true, userId: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
  });

  let done = 0;
  for (const grant of stuck) {
    try {
      await syncTradingViewGrant(grant.userId);
      done += 1;
    } catch (e) {
      console.error("reconcile: retry grant failed", grant.id, e);
    }
  }
  return done;
}

/**
 * คิวถอนสิทธิ์ที่ค้าง: PENDING_REVOKE คือตอนหมดอายุแล้วบอทถอนไม่สำเร็จ
 * ปล่อยไว้แปลว่าคนที่หมดอายุยังใช้อินดิเคเตอร์ได้ฟรี
 */
async function retryPendingRevokes(cutoff: Date): Promise<number> {
  const stuck = await prisma.accessGrant.findMany({
    where: { status: "PENDING_REVOKE", createdAt: { lt: cutoff } },
    select: { id: true, user: { select: { tradingViewUsername: true } } },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
  });

  let done = 0;
  for (const grant of stuck) {
    const username = grant.user.tradingViewUsername;
    if (!username) continue;
    try {
      const res = await revokeTradingViewAccess(username);
      if (res.ok) {
        await prisma.accessGrant.update({
          where: { id: grant.id },
          data: res.queued
            ? { note: "สั่งบอทถอนสิทธิ์ซ้ำแล้ว รอผลยืนยัน" }
            : { status: "REVOKED", revokedAt: new Date(), note: "ถอนสิทธิ์อัตโนมัติ (ไล่งานค้าง)" },
        });
        done += 1;
      }
    } catch (e) {
      console.error("reconcile: retry revoke failed", grant.id, e);
    }
  }
  return done;
}

/**
 * ลิงก์เชิญ Telegram ที่ยังไม่ได้สร้าง — เกิดเมื่อ Telegram ล่มตอนเปิดสิทธิ์
 * ลูกค้าจ่ายเงินแล้วแต่ไม่มีลิงก์เข้ากลุ่ม จึงต้องตามสร้างให้
 */
async function backfillTelegramInvites(cutoff: Date): Promise<number> {
  const missing = await prisma.telegramGrant.findMany({
    where: {
      status: "PENDING",
      inviteLink: null,
      createdAt: { lt: cutoff },
      user: {
        subscriptions: {
          some: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gt: new Date() } },
        },
      },
    },
    select: { id: true, userId: true },
    take: MAX_PER_RUN,
  });

  let done = 0;
  for (const grant of missing) {
    try {
      await ensureTelegramInvite(grant.userId);
      done += 1;
    } catch (e) {
      console.error("reconcile: backfill invite failed", grant.id, e);
    }
  }
  return done;
}

/** คิวที่รอลูกค้ากรอก username — ระบบทำอะไรต่อไม่ได้จนกว่าจะมีชื่อ */
function countWaitingForUsername(cutoff: Date) {
  return prisma.accessGrant.count({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      user: { tradingViewUsername: null },
    },
  });
}

export async function runReconcile(): Promise<ReconcileResult> {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000);

  const empty: ReconcileResult = {
    grantsRetried: 0,
    revokesRetried: 0,
    invitesCreated: 0,
    waitingForUsername: 0,
  };

  // ไม่ได้ตั้งบอทไว้ = ระบบทำงานแบบแอดมินกดเองอยู่แล้ว ไม่ต้องไล่อะไร
  if (!tvAutoGrantEnabled) {
    return { ...empty, skipped: "ยังไม่ได้ตั้งค่าบอท TradingView" };
  }

  const [grantsRetried, revokesRetried, invitesCreated, waitingForUsername] = await Promise.all([
    retryPendingGrants(cutoff).catch((e) => {
      console.error("reconcile: grants step failed", e);
      return 0;
    }),
    retryPendingRevokes(cutoff).catch((e) => {
      console.error("reconcile: revokes step failed", e);
      return 0;
    }),
    telegramGroupManaged
      ? backfillTelegramInvites(cutoff).catch((e) => {
          console.error("reconcile: invites step failed", e);
          return 0;
        })
      : Promise.resolve(0),
    countWaitingForUsername(cutoff).catch(() => 0),
  ]);

  return { grantsRetried, revokesRetried, invitesCreated, waitingForUsername };
}
