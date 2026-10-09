import { prisma } from "@/lib/prisma";
import { syncTradingViewGrant, ensureTelegramInvite } from "@/lib/lifecycle";
import { revokeTradingViewAccess, tvAutoGrantEnabled, bridgeQueueDepth } from "@/lib/tradingview";
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

/**
 * สั่งบอทไปแล้วต้องรอนานกว่านี้ถึงสั่งซ้ำ
 *
 * บอททำได้ทีละคน ราว 90 วินาที คิวยาว 15 คนจึงกินเวลาเกิน 20 นาที
 * ถ้าใช้ GRACE_MINUTES เท่ากับการสั่งครั้งแรก งานที่ยังนั่งรอคิวอยู่จะถูกสั่งซ้ำ
 * ทุกรอบ cron แล้วบอทต้องทำคนเดิมซ้ำ 2-3 หน คนที่ต่อคิวอยู่ข้างหลังก็ได้ช้าลงไปอีก
 * (เจอจริง 30 ก.ย. 69 — ชุด 15 คนถูกเพิ่มซ้ำรอบสองทั้งชุด)
 */
const REDISPATCH_MINUTES = 30;

/**
 * บอทตอบว่าคิวว่าง = งานที่เราคิดว่า "สั่งไปแล้ว" หายไปกับการรีสตาร์ตของบอท
 * รอสั้นลงได้ แต่ยังต้องรอ — ห้ามข้ามเวลารอทิ้งไปเลย
 *
 * ของเดิมเขียนเป็นทางลัด "คิวว่าง = ข้ามเวลารอ" ซึ่งบอทว่างเกือบตลอดเวลา
 * เท่ากับไม่มีเวลารออยู่จริง งานที่ไม่มีวันสำเร็จจึงถูกสั่งซ้ำทุกรอบ cron
 * เงื่อนไขที่เป็น "เร็วขึ้น" ปลอดภัยกว่าเงื่อนไขที่เป็น "ข้ามทิ้ง" เสมอ
 * เพราะอย่างแย่ที่สุดก็ยังมีเพดานกั้นอยู่
 */
const IDLE_REDISPATCH_MINUTES = 10;

/**
 * ล้มเหลวติดกันเกินนี้ = เลิกลองเอง ต้องให้คนมาดู
 *
 * บางงานลองอีกกี่ครั้งก็ไม่สำเร็จ ที่เจอบ่อยสุดคือลูกค้ากรอกชื่อ TradingView
 * ที่ไม่มีอยู่จริง บอทจะตอบ "ไม่พบ username" ทุกครั้งไม่ว่าจะลองกี่หน
 * ปล่อยให้วนต่อ = เปลืองคิวบอทที่ทำได้ทีละคน และเด้งเตือนแอดมินจนเลิกอ่าน
 * (เจอจริง 5 ต.ค. 69 — @Kiadthawee วนทุก 5 นาทีพร้อมเตือน 2 ข้อความต่อรอบ)
 */
const MAX_FAILS = 5;

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
  const queue = await bridgeQueueDepth();
  const waitMinutes = queue === 0 ? IDLE_REDISPATCH_MINUTES : REDISPATCH_MINUTES;
  const redispatchCutoff = new Date(Date.now() - waitMinutes * 60_000);
  const notInFlight = {
    OR: [{ lastDispatchedAt: null }, { lastDispatchedAt: { lt: redispatchCutoff } }],
  };

  const stuck = await prisma.accessGrant.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      // ล้มเหลวติดกันหลายครั้งแล้ว = ไม่หยิบมาวนอีก รอคนมาแก้ต้นเหตุ
      failCount: { lt: MAX_FAILS },
      ...notInFlight,
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
      // จดก่อนยิง — ยิงแล้วพังก็ยังไม่ควรถล่มซ้ำทันทีในรอบหน้า
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: { lastDispatchedAt: new Date() },
      });
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

/**
 * ตรวจว่ารอบนี้ "จะ" หยิบใครไปสั่งซ้ำบ้าง โดยไม่แตะอะไรเลย
 *
 * ไล่บั๊กเรื่องสั่งซ้ำมาสองรอบแล้วพบว่าปัญหาเดียวกันทุกครั้ง: มองไม่เห็นว่าทำไม
 * แถวนั้นถึงยังโดนหยิบ ต้องเดาจากข้อความที่เด้งเข้ากลุ่ม แล้วรันของจริงเพื่อทดสอบ
 * ซึ่งเท่ากับสแปมแอดมินเพิ่มทุกครั้งที่อยากรู้ ตัวนี้ตอบคำถามนั้นตรง ๆ โดยไม่ส่งอะไร
 */
export async function inspectReconcile() {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000);
  const queue = await bridgeQueueDepth();
  const waitMinutes = queue === 0 ? IDLE_REDISPATCH_MINUTES : REDISPATCH_MINUTES;
  const now = Date.now();

  const candidates = await prisma.accessGrant.findMany({
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
    select: {
      id: true,
      createdAt: true,
      failCount: true,
      lastFailReason: true,
      lastDispatchedAt: true,
      user: { select: { email: true, tradingViewUsername: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = candidates.map((g) => {
    const minutesSince = g.lastDispatchedAt ? (now - g.lastDispatchedAt.getTime()) / 60_000 : null;
    const reason =
      g.failCount >= MAX_FAILS
        ? `ข้าม — ล้มเหลวครบ ${MAX_FAILS} ครั้ง ระบบเลิกลองแล้ว รอคนแก้ต้นเหตุ`
        : minutesSince !== null && minutesSince < waitMinutes
          ? `ข้าม — เพิ่งสั่งไป ${Math.round(minutesSince)} นาที (ต้องรอ ${waitMinutes} นาที)`
          : "จะสั่งซ้ำรอบนี้";
    return {
      tradingView: g.user.tradingViewUsername,
      email: g.user.email,
      failCount: g.failCount,
      lastFailReason: g.lastFailReason,
      minutesSinceDispatch: minutesSince === null ? null : Math.round(minutesSince),
      verdict: reason,
    };
  });

  // ลูกค้าคนเดียวมีคิวค้างหลายแถว = แต่ละส่วนของระบบอาจหยิบคนละแถว ต้องรู้ไว้
  const perUser = new Map<string, number>();
  for (const g of candidates) perUser.set(g.user.email ?? "?", (perUser.get(g.user.email ?? "?") ?? 0) + 1);
  const duplicateQueues = [...perUser.entries()].filter(([, n]) => n > 1).map(([email, n]) => ({ email, rows: n }));

  return {
    bridgeQueue: queue,
    waitMinutes,
    willDispatch: rows.filter((r) => r.verdict === "จะสั่งซ้ำรอบนี้").length,
    duplicateQueues,
    grants: rows,
  };
}
