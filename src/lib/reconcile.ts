import { prisma } from "@/lib/prisma";
import {
  syncTradingViewGrant,
  ensureTelegramInvite,
  healActiveMembersQueuedForRemoval,
} from "@/lib/lifecycle";
import { revokeTradingViewAccess, tvAutoGrantEnabled, bridgeQueueDepth } from "@/lib/tradingview";
import { telegramGroupManaged } from "@/lib/telegram";
import { sendAdminAlertThrottled } from "@/lib/alert-throttle";
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
export const MAX_FAILS = 5;

/** เพดานต่อรอบ — cron วิ่งถี่อยู่แล้ว ค่อย ๆ เก็บดีกว่าหมดเวลากลางทาง */
const MAX_PER_RUN = 15;

/**
 * เลยเพดาน MAX_FAILS แล้วยังลองได้ — แต่วันละครั้ง
 *
 * MAX_FAILS มีไว้กัน "วงวนทุก 5 นาที" ไม่ได้มีไว้ตัดสินว่างานนี้เป็นไปไม่ได้ตลอดกาล
 * แต่โค้ดเดิมแปลว่าอย่างหลัง ซึ่งพังหนักเวลาต้นเหตุเป็นเรื่องของระบบ ไม่ใช่ของรายคน
 *
 * เจอจริง 2 พ.ย. 69: TradingView เปลี่ยน data-qa-id ของช่องค้นหา บอทถอนสิทธิ์
 * ล้มเหลว 330 งานรวดในวันเดียว ทุกแถวกินโควตาจนครบ พอซ่อมบอทเสร็จก็ไม่มีแถวไหน
 * ได้ลองอีกเลย — คิวถอน 101 รายตายสนิท คนที่หมดอายุใช้อินดิเคเตอร์ฟรีต่อไป
 * จนกว่าจะมีคนมานั่งกดเอง ซึ่งไม่มีใครรู้ด้วยซ้ำว่าต้องไปกด
 *
 * วันละครั้งไม่ใช่สแปม (ของเดิมที่ไม่มีเพดานเลยคือ ~288 ครั้ง/วัน) แต่พอให้ระบบ
 * ฟื้นเองได้เมื่อต้นเหตุหายไป ส่วนงานที่ไม่มีวันสำเร็จจริง ๆ เช่นชื่อ TradingView
 * ที่ไม่มีอยู่ ก็เสียแค่วันละงานเดียว แลกกับการไม่ต้องมีคนคอยปลุกระบบ
 */
const GIVE_UP_RETRY_HOURS = 24;

/** ยังอยู่ในโควตาความล้มเหลว หรือเลยมาแล้วแต่ถึงรอบลองประจำวัน */
function withinFailBudget(now: number) {
  const dailyRetryCutoff = new Date(now - GIVE_UP_RETRY_HOURS * 3_600_000);
  return {
    OR: [{ failCount: { lt: MAX_FAILS } }, { lastDispatchedAt: { lt: dailyRetryCutoff } }],
  };
}

export interface ReconcileResult {
  /** คิวให้สิทธิ์ที่สั่งบอทซ้ำ */
  grantsRetried: number;
  /** คิวถอนสิทธิ์ที่ค้างแล้วสั่งซ้ำ */
  revokesRetried: number;
  /** ลิงก์เชิญ Telegram ที่สร้างย้อนหลังให้ */
  invitesCreated: number;
  /** คิวที่รอลูกค้ากรอก username — ไม่ใช่ความผิดพลาดของระบบ แต่ควรรู้จำนวน */
  waitingForUsername: number;
  /** สิทธิ์ที่ถูกถอนผิดทั้งที่ลูกค้ายังจ่ายเงินอยู่ แล้วคืนให้ในรอบนี้ — ปกติต้องเป็น 0 */
  healed: number;
  /** กลุ่มความล้มเหลวที่กว้างพอจะถือว่าพังทั้งระบบ แล้วเตือนไปในรอบนี้ */
  systemicAlerts: number;
  skipped?: string;
}

/**
 * คิวให้สิทธิ์ที่ค้าง: PENDING + มี username + แพ็กเกจยังใช้งานอยู่
 *
 * เงื่อนไข "แพ็กเกจยังใช้งานอยู่" สำคัญมาก — ไม่งั้นคิวเก่าของคนที่หมดอายุไปแล้ว
 * จะถูกปลุกขึ้นมาให้สิทธิ์ใหม่เรื่อย ๆ
 */
async function retryPendingGrants(cutoff: Date, waitMinutes: number): Promise<number> {
  const redispatchCutoff = new Date(Date.now() - waitMinutes * 60_000);
  const notInFlight = {
    OR: [{ lastDispatchedAt: null }, { lastDispatchedAt: { lt: redispatchCutoff } }],
  };

  const stuck = await prisma.accessGrant.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      // ล้มเหลวติดกันหลายครั้ง = พักไว้ แล้วกลับมาลองวันละครั้ง (ดู withinFailBudget)
      AND: [notInFlight, withinFailBudget(Date.now())],
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
async function retryPendingRevokes(cutoff: Date, waitMinutes: number): Promise<number> {
  /**
   * คิวถอนต้องมีเวลารอและเพดานเลิกลอง "เหมือนคิวให้สิทธิ์" — ของเดิมไม่มีทั้งคู่
   *
   * ของเดิมหยิบ PENDING_REVOKE 15 แถวที่เก่าสุดทุกรอบ cron (ทุก 10 นาที) โดยไม่ดูว่า
   * เพิ่งสั่งไปหรือยัง และบอทเกือบทุกครั้งตอบ queued = true (รับงานเข้าคิว ยังไม่ทำ)
   * แถวจึงคาสถานะ PENDING_REVOKE แล้วถูกหยิบซ้ำรอบหน้า — **ชุดเดิมทั้ง 15 คน วนไม่จบ**
   *
   * ผลลัพธ์จริงที่วัดได้ 30 ต.ค. 69: คิวบอทบวม 370+ งาน (≈ 90 งานขยะต่อชั่วโมง)
   * บอททำได้ทีละคน 60-120 วินาที ลูกค้าที่เพิ่งจ่ายเงินจึงต้องต่อคิวหลังงานขยะ 6+ ชั่วโมง
   * — เป็นสาเหตุที่คำสั่งซ่อม 7 รายของวันนั้นไม่มีใครได้ผลกลับมาเลยใน 22 นาที
   *
   * บั๊กตัวเดียวกันนี้เคยเกิดกับ "คิวให้สิทธิ์" แล้วแก้ไปตั้งแต่ 30 ก.ย. / 10 ต.ค. 69
   * ด้วย lastDispatchedAt + failCount + MAX_FAILS แต่ไม่มีใครย้อนกลับมาแก้ฝั่งถอน
   */
  const redispatchCutoff = new Date(Date.now() - waitMinutes * 60_000);

  const stuck = await prisma.accessGrant.findMany({
    where: {
      status: "PENDING_REVOKE",
      createdAt: { lt: cutoff },
      AND: [
        { OR: [{ lastDispatchedAt: null }, { lastDispatchedAt: { lt: redispatchCutoff } }] },
        withinFailBudget(Date.now()),
      ],
      /**
       * ห้ามถอนสิทธิ์คนที่แพ็กเกจยังใช้งานอยู่ — ไม่ว่าคิวจะบอกอะไรก็ตาม
       *
       * คิวถอนเกิดตอนหมดอายุ แต่ลูกค้าต่ออายุทีหลังได้ และถ้าบอทถอนไม่สำเร็จ
       * แถวนั้นจะค้างเป็น PENDING_REVOKE ข้ามรอบบิลไปเรื่อย ๆ
       * พอเราเพิ่งสั่งให้สิทธิ์เขาใหม่ reconcile รอบถัดไปจะถอนออกให้เอง
       * = ลูกค้าจ่ายเงินแล้วสิทธิ์หลุดภายใน 10 นาที โดยไม่มีใครเห็นว่าเกิดอะไรขึ้น
       *
       * เจอจริง 30 ต.ค. 69: @anupong6914 ที่เพิ่งซ่อมสิทธิ์ให้ ยังมีคิวถอนค้างอยู่
       * (รอดเพราะ failCount 14 เกินเพดานพอดี ไม่ใช่เพราะระบบตั้งใจกัน)
       *
       * ฝั่งให้สิทธิ์เช็ก "แพ็กเกจยังใช้งานอยู่" มาตั้งแต่แรก ฝั่งถอนไม่เคยเช็ก
       */
      user: {
        subscriptions: {
          none: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gt: new Date() } },
        },
      },
    },
    select: { id: true, user: { select: { tradingViewUsername: true } } },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
  });

  let done = 0;
  for (const grant of stuck) {
    const username = grant.user.tradingViewUsername;
    if (!username) continue;
    try {
      // จดก่อนยิงเสมอ ไม่ใช่เฉพาะตอนสำเร็จ — งานที่ล้มเหลวต้องมีเวลาให้เทียบด้วย
      // ไม่งั้นมันจะกลายเป็น "ไม่เคยสั่ง" ในสายตารอบหน้าแล้ววนซ้ำทันที
      await prisma.accessGrant
        .update({ where: { id: grant.id }, data: { lastDispatchedAt: new Date() } })
        .catch(() => {});

      const res = await revokeTradingViewAccess(username);
      if (res.ok) {
        await prisma.accessGrant.update({
          where: { id: grant.id },
          data: res.queued
            ? { note: "สั่งบอทถอนสิทธิ์ซ้ำแล้ว รอผลยืนยัน" }
            : {
                status: "REVOKED",
                revokedAt: new Date(),
                note: "ถอนสิทธิ์อัตโนมัติ (ไล่งานค้าง)",
                failCount: 0,
                lastFailReason: null,
              },
        });
        done += 1;
      } else {
        /**
         * นับเฉพาะตอนบอท "ปฏิเสธงาน" — ติดต่อบอทไม่ได้คือปัญหาของท่อ ไม่ใช่ของงาน
         * (กฎเดียวกับฝั่งให้สิทธิ์ใน syncTradingViewGrant)
         */
        await prisma.accessGrant.update({
          where: { id: grant.id },
          data: {
            note: `บอทถอนสิทธิ์ไม่สำเร็จ: ${res.reason ?? "ไม่ทราบสาเหตุ"}`,
            ...(res.unreachable ? {} : { failCount: { increment: 1 } }),
            lastFailReason: res.reason ?? "ไม่ทราบสาเหตุ",
          },
        });
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
    healed: 0,
    systemicAlerts: 0,
  };

  // ไม่ได้ตั้งบอทไว้ = ระบบทำงานแบบแอดมินกดเองอยู่แล้ว ไม่ต้องไล่อะไร
  if (!tvAutoGrantEnabled) {
    return { ...empty, skipped: "ยังไม่ได้ตั้งค่าบอท TradingView" };
  }

  // ถามความลึกคิวบอทครั้งเดียวแล้วใช้ร่วมกันทั้งสองฝั่ง — เดิมถามเฉพาะฝั่งให้สิทธิ์
  // ฝั่งถอนจึงไม่เคยรู้ว่าคิวยาวแค่ไหน แล้วสั่งซ้ำทับคิวที่ยังทำไม่เสร็จ
  const queue = await bridgeQueueDepth().catch(() => null);
  const waitMinutes = queue === 0 ? IDLE_REDISPATCH_MINUTES : REDISPATCH_MINUTES;

  /**
   * คืนสิทธิ์ที่ถูกถอนผิดก่อนทำอย่างอื่นเสมอ
   *
   * เดิมด่านนี้อยู่ในรอบกวาดรายวันที่เดียว ซึ่งแปลว่าลูกค้าที่โดนถอนผิดตอนบ่าย
   * ต้องรอถึงตีสามกว่าจะได้สิทธิ์คืน reconcile วิ่งทุก 5 นาทีอยู่แล้ว
   * เอามาเสียบตรงนี้ด้วยทำให้เวลารอกลายเป็นหลักนาที
   *
   * ต้องมาก่อน retryPendingRevokes ในรอบเดียวกัน ไม่งั้นใบถอนที่เพิ่งจะถูกล้าง
   * อาจถูกหยิบไปสั่งในรอบนี้เสียก่อน
   */
  const healed = await healActiveMembersQueuedForRemoval().catch((e) => {
    console.error("reconcile: heal step failed", e);
    return { grants: 0, telegram: 0, members: [] as string[] };
  });

  const [grantsRetried, revokesRetried, invitesCreated, waitingForUsername] = await Promise.all([
    retryPendingGrants(cutoff, waitMinutes).catch((e) => {
      console.error("reconcile: grants step failed", e);
      return 0;
    }),
    retryPendingRevokes(cutoff, waitMinutes).catch((e) => {
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

  // ดูภาพรวมหลังสั่งงานรอบนี้เสร็จ — ตัวเลขจะได้รวมผลล่าสุดด้วย
  const systemicAlerts = await reportSystemicFailures().catch((e) => {
    console.error("reconcile: systemic check failed", e);
    return 0;
  });

  return {
    grantsRetried,
    revokesRetried,
    invitesCreated,
    waitingForUsername,
    healed: healed.grants,
    systemicAlerts,
  };
}

/**
 * กี่คนที่ติดเพดานด้วย "เหตุผลเดียวกัน" ถึงจะถือว่าพังทั้งระบบ ไม่ใช่พังรายคน
 *
 * ชื่อ TradingView ที่ไม่มีอยู่จริงกระทบคนเดียว และข้อความจะมีชื่อคนนั้นอยู่ด้วย
 * จึงไม่มีวันจับกลุ่มกับใคร ส่วนของที่พังระดับระบบ — บอทล็อกเอาต์, TradingView
 * เปลี่ยน DOM, บริดจ์ตอบ error เหมือนกันหมด — จะได้ข้อความเดียวกันเป๊ะทุกคน
 */
const SYSTEMIC_FAIL_MEMBERS = 5;

/**
 * บอกเมื่อ "การส่งมอบกำลังล้มเหลวเป็นวงกว้าง" ไม่ใช่รอให้ลูกค้ามาโวย
 *
 * ช่องโหว่ที่เจอ 2 พ.ย. 69: TradingView เปลี่ยน data-qa-id ของช่องค้นหา
 * บอทถอนสิทธิ์ล้มเหลว 330 งานรวดภายในวันเดียว และ **ไม่มีการแจ้งเตือนใดที่ดังพอ**
 * เพราะแต่ละใบล้มเหลวแยกกัน ตัวกันสแปมกลบข้อความซ้ำทิ้ง (ซึ่งถูกของมัน)
 * แต่ไม่มีใครรวมตัวเลขแล้วถามว่า "ทำไมทุกใบถึงพังพร้อมกัน"
 * กว่าจะรู้ก็ตอนแอดมินทักมาว่าลูกค้าเข้าไม่ได้ — 13 วันหลังของจริงเริ่มพัง
 *
 * ตัวนี้ดูภาพรวมแทนการดูทีละใบ: ถ้ามีสมาชิกหลายคนติดเพดานด้วยข้อความเดียวกัน
 * แปลว่าต้นเหตุเป็นของส่วนกลาง ไม่ใช่เรื่องของลูกค้ารายไหน
 *
 * ใช้ตัวกันซ้ำ 6 ชม. ต่อ "เหตุผล" ไม่ใช่ต่อใบ — เหตุผลใหม่โผล่เมื่อไหร่ดังทันที
 * ซึ่งเป็นพฤติกรรมที่ต้องการพอดี เพราะเหตุผลใหม่ = ของใหม่ที่เพิ่งพัง
 */
async function reportSystemicFailures(): Promise<number> {
  const stuck = await prisma.accessGrant.findMany({
    where: {
      status: { in: ["PENDING", "PENDING_REVOKE"] },
      failCount: { gte: MAX_FAILS },
      lastFailReason: { not: null },
    },
    select: {
      status: true,
      lastFailReason: true,
      failCount: true,
      user: { select: { email: true, tradingViewUsername: true } },
    },
    take: 500,
  });

  const byReason = new Map<string, typeof stuck>();
  for (const g of stuck) {
    const key = g.lastFailReason ?? "";
    const list = byReason.get(key);
    if (list) list.push(g);
    else byReason.set(key, [g]);
  }

  let alerted = 0;
  for (const [reason, rows] of byReason) {
    if (rows.length < SYSTEMIC_FAIL_MEMBERS) continue;

    const who = rows
      .slice(0, 5)
      .map((r) => r.user.tradingViewUsername ?? r.user.email ?? "-")
      .join(", ");
    const grants = rows.filter((r) => r.status === "PENDING").length;
    const revokes = rows.length - grants;

    const text =
      `🔴 ส่งมอบล้มเหลวเป็นวงกว้าง ${rows.length} ราย — เหตุผลเดียวกันทุกคน\n` +
      `"${reason}"\n` +
      `แยกเป็น: ให้สิทธิ์ค้าง ${grants} · ถอนสิทธิ์ค้าง ${revokes}\n` +
      `ตัวอย่าง: ${who}\n\n` +
      `หลายคนพังด้วยข้อความเดียวกัน = ต้นเหตุอยู่ที่ส่วนกลาง ไม่ใช่ที่ลูกค้า\n` +
      `เช็กตามลำดับ: บอทยัง login TradingView อยู่ไหม · selector ในกล่อง` +
      `จัดการการเข้าถึงเปลี่ยนหรือยัง (ดู bot_out.log) · บริดจ์ตัวไหนรับงานอยู่`;

    // คิวล้มเหลวทั้งวงยังไงก็ต้องมีคนมาดู ปล่อยให้ตัวกันซ้ำคุมความถี่พอ
    const res = await sendAdminAlertThrottled(`systemic-fail:${reason}`, text).catch((e) => {
      console.error("reconcile: systemic alert failed", e);
      return null;
    });
    if (res?.sent) alerted += 1;
  }
  return alerted;
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

  /**
   * คำตัดสินต้องเดินตามเงื่อนไข where จริง ไม่ใช่เดินตามที่เราจำว่าเขียนไว้
   * เครื่องมือวินิจฉัยที่บอกไม่ตรงกับของจริง ทำให้เชื่อผิดได้แรงกว่าไม่มีเลย
   */
  const verdictFor = (failCount: number, minutesSince: number | null): string => {
    const hoursSince = minutesSince === null ? null : minutesSince / 60;
    if (failCount >= MAX_FAILS) {
      if (hoursSince === null) return `ข้าม — ล้มเหลวครบ ${MAX_FAILS} ครั้ง และยังไม่เคยสั่ง`;
      if (hoursSince < GIVE_UP_RETRY_HOURS) {
        const left = Math.ceil(GIVE_UP_RETRY_HOURS - hoursSince);
        return `พัก — ล้มเหลวครบ ${MAX_FAILS} ครั้ง จะลองใหม่ในอีก ~${left} ชม.`;
      }
      return "จะสั่งซ้ำรอบนี้ (รอบลองประจำวัน)";
    }
    if (minutesSince !== null && minutesSince < waitMinutes) {
      return `ข้าม — เพิ่งสั่งไป ${Math.round(minutesSince)} นาที (ต้องรอ ${waitMinutes} นาที)`;
    }
    return "จะสั่งซ้ำรอบนี้";
  };

  const rows = candidates.map((g) => {
    const minutesSince = g.lastDispatchedAt ? (now - g.lastDispatchedAt.getTime()) / 60_000 : null;
    const reason = verdictFor(g.failCount, minutesSince);
    return {
      tradingView: g.user.tradingViewUsername,
      email: g.user.email,
      failCount: g.failCount,
      lastFailReason: g.lastFailReason,
      minutesSinceDispatch: minutesSince === null ? null : Math.round(minutesSince),
      verdict: reason,
    };
  });

  /**
   * คิวถอนต้องส่องด้วย — ไม่งั้นมองไม่เห็นว่าอะไรยัดงานเข้าคิวบอท
   *
   * ของเดิมส่องเฉพาะคิวให้สิทธิ์ ตอนไล่บั๊ก 30 ต.ค. 69 ตัวนี้จึงรายงานว่า
   * "จะสั่ง 0 งาน" อย่างมั่นใจ ขณะที่คิวบอทบวมจาก 366 เป็น 394 ใน 45 วินาที
   * เครื่องมือวินิจฉัยที่มองไม่เห็นครึ่งหนึ่งของระบบ ทำให้เชื่อผิดได้แรงกว่าไม่มีเลย
   */
  const revokeRows = (
    await prisma.accessGrant.findMany({
      where: { status: "PENDING_REVOKE", createdAt: { lt: cutoff } },
      select: {
        failCount: true,
        lastFailReason: true,
        lastDispatchedAt: true,
        user: {
          select: {
            email: true,
            tradingViewUsername: true,
            subscriptions: {
              where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gt: new Date() } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  ).map((g) => {
    const minutesSince = g.lastDispatchedAt ? (now - g.lastDispatchedAt.getTime()) / 60_000 : null;
    const verdict = g.user.subscriptions.length > 0
      ? "ข้าม — แพ็กเกจยังใช้งานอยู่ ห้ามถอน (คิวค้างจากรอบก่อน)"
      : !g.user.tradingViewUsername
      ? "ข้าม — ไม่มี username ให้ถอน"
      : verdictFor(g.failCount, minutesSince).replace("จะสั่งซ้ำ", "จะสั่งถอนซ้ำ");
    return {
      tradingView: g.user.tradingViewUsername,
      email: g.user.email,
      failCount: g.failCount,
      lastFailReason: g.lastFailReason,
      minutesSinceDispatch: minutesSince === null ? null : Math.round(minutesSince),
      verdict,
    };
  });

  // ลูกค้าคนเดียวมีคิวค้างหลายแถว = แต่ละส่วนของระบบอาจหยิบคนละแถว ต้องรู้ไว้
  const perUser = new Map<string, number>();
  for (const g of candidates) perUser.set(g.user.email ?? "?", (perUser.get(g.user.email ?? "?") ?? 0) + 1);
  const duplicateQueues = [...perUser.entries()].filter(([, n]) => n > 1).map(([email, n]) => ({ email, rows: n }));

  return {
    bridgeQueue: queue,
    waitMinutes,
    // นับด้วย startsWith เพราะคำตัดสินมีวงเล็บต่อท้ายได้ (เช่น "รอบลองประจำวัน")
    // เทียบสตริงเป๊ะ ๆ เคยทำให้ตัวนับเป็น 0 ทั้งที่กำลังจะสั่งงานจริง
    willDispatch: rows.filter((r) => r.verdict.startsWith("จะสั่ง")).length,
    willRevoke: revokeRows.filter((r) => r.verdict.startsWith("จะสั่ง")).length,
    pendingRevokeTotal: revokeRows.length,
    /** คิวถอนที่ค้างอยู่บนคนที่ยังจ่ายเงินอยู่ = ระเบิดเวลา ต้องเป็น 0 */
    revokeOnActiveMember: revokeRows.filter((r) => r.verdict.startsWith("ข้าม — แพ็กเกจยังใช้งานอยู่")).length,
    duplicateQueues,
    grants: rows,
    // ตัดให้พอเห็นรูปแบบ ไม่งั้น JSON ยาวจนอ่านในเทอร์มินัลไม่ไหวตอนคิวบวม
    revokes: revokeRows.slice(0, 20),
  };
}
