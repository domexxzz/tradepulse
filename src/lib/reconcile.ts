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
  /** ลิงก์เชิญ Telegram ที่สร้างย้อนหลังให้ — นับเฉพาะที่ได้ลิงก์จริง */
  invitesCreated: number;
  /** ใบเก่าที่ไม่มีลิงก์และมีใบใหม่คุมอยู่แล้ว — ปิดทิ้งไปกี่ใบ ปกติควรเป็น 0 */
  invitesStale: number;
  /** คิวที่รอลูกค้ากรอก username — ไม่ใช่ความผิดพลาดของระบบ แต่ควรรู้จำนวน */
  waitingForUsername: number;
  /** สิทธิ์ที่ถูกถอนผิดทั้งที่ลูกค้ายังจ่ายเงินอยู่ แล้วคืนให้ในรอบนี้ — ปกติต้องเป็น 0 */
  healed: number;
  /** สั่งซ้ำให้วันหมดอายุบน TradingView ตรงกับที่ลูกค้าจ่าย — กี่รายในรอบนี้ */
  resynced: number;
  /** กลุ่มความล้มเหลวที่กว้างพอจะถือว่าพังทั้งระบบ — เจอกี่กลุ่ม */
  systemicFound: number;
  /** ในนั้นส่งแจ้งเตือนออกไปได้จริงกี่กลุ่ม — เจอแต่ส่งไม่ออก = ท่อแจ้งเตือนพัง */
  systemicAlerts: number;
  /** ถ้าไม่ได้ส่ง เพราะอะไร — "โดนกันซ้ำ" กับ "ส่งไม่ออก" เป็นคนละเรื่อง */
  systemicNotSent?: string[];
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
async function backfillTelegramInvites(cutoff: Date): Promise<{ created: number; stale: number }> {
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

  let created = 0;
  let stale = 0;
  for (const grant of missing) {
    try {
      await ensureTelegramInvite(grant.userId);

      /**
       * นับเฉพาะที่ "ได้ลิงก์จริง" ไม่ใช่ "เรียกแล้วไม่ throw"
       *
       * ensureTelegramInvite กลืน error ไว้ข้างในทั้งหมด (ตั้งใจ — ล้มที่ Telegram
       * ไม่ควรลากการเปิดสิทธิ์ร่วงไปด้วย) ตัวที่เรียกจึงแยกไม่ออกเลยว่าสำเร็จหรือไม่
       * ของเดิมนับว่าสำเร็จทุกครั้ง ตัวเลขที่รายงานจึงเป็นเท็จโดยสมบูรณ์
       * นี่คือบั๊กตัวเดียวกับที่เคยทำให้ failCount พัง — "สั่งไปแล้ว" ไม่ใช่ "สำเร็จแล้ว"
       */
      const after = await prisma.telegramGrant.findUnique({
        where: { id: grant.id },
        select: { inviteLink: true },
      });
      if (after?.inviteLink) {
        created += 1;
        continue;
      }

      /**
       * ไม่ได้ลิงก์ แต่เจ้าของมีใบอื่นที่ใช้งานได้อยู่แล้ว = ใบนี้เป็นของตกค้าง
       *
       * ตัวเลือกแถวกับตัวซ่อมมองคนละใบ: ที่นี่เลือก "ใบที่ไม่มีลิงก์"
       * แต่ ensureTelegramInvite ทำงานกับ "ใบล่าสุด" ของผู้ใช้คนนั้นเสมอ
       * ถ้าใบล่าสุดมีลิงก์ที่ยังไม่หมดอายุ มันจะ return ทันทีโดยไม่แตะใบเก่า
       * ใบเก่าจึงถูกหยิบซ้ำทุก 5 นาทีตลอดไป พร้อมรายงานว่า "สร้างลิงก์ 1 ใบ" ทุกครั้ง
       * (เห็นจริงบน production 2 พ.ย. 69 — invitesCreated = 1 ทุกรอบติดกันเป็นชั่วโมง
       *  ทั้งที่สมาชิกทั้ง 190 คนมีลิงก์หรืออยู่ในกลุ่มครบแล้ว)
       */
      const covered = await prisma.telegramGrant.findFirst({
        where: {
          userId: grant.userId,
          id: { not: grant.id },
          OR: [{ status: "ADDED" }, { inviteLink: { not: null } }],
        },
        select: { id: true },
      });
      if (covered) {
        await prisma.telegramGrant.update({
          where: { id: grant.id },
          data: { status: "SUPERSEDED", note: "มีใบที่ใช้งานได้อยู่แล้ว — ปิดใบเก่าที่ไม่มีลิงก์" },
        });
        stale += 1;
      }
    } catch (e) {
      console.error("reconcile: backfill invite failed", grant.id, e);
    }
  }
  return { created, stale };
}

/**
 * สูงสุดกี่คนต่อรอบสำหรับงาน "ไล่ให้ TradingView ตรงกับที่ลูกค้าจ่าย"
 *
 * น้อยกว่าคิวปกติมาก และทำเฉพาะตอนบอทว่างจริง ๆ เพราะงานนี้ไม่ด่วนเท่าคนที่
 * เพิ่งจ่ายเงินแล้วนั่งรออยู่ คนกลุ่มนั้นต้องได้คิวก่อนเสมอ
 */
const MAX_RESYNC_PER_RUN = 5;

/** ยอมให้คลาดกันได้เท่านี้ ก่อนถือว่า "ให้สิทธิ์ไว้สั้นกว่าที่ลูกค้าจ่าย" */
const RESYNC_TOLERANCE_HOURS = 36;

/**
 * ไล่ให้วันหมดอายุบน TradingView ตรงกับที่ลูกค้าจ่ายมาจริง
 *
 * ช่องโหว่ที่ปิด: reconcile เดิมมองแค่แถว PENDING แถวที่เป็น GRANTED แล้วถือว่าจบ
 * แต่ "GRANTED" บอกแค่ว่าเคยให้สำเร็จ ไม่ได้บอกว่าให้ถึงวันไหน
 *
 * ลูกค้าต่ออายุตอนบอทติดต่อไม่ได้ → คำสั่งต่อวันไปไม่ถึง TradingView → แถวยัง GRANTED
 * → ไม่มีใครสั่งซ้ำ → สิทธิ์จริงดับตามวันเดิม ขณะที่หน้าแอดมินขึ้นว่า "เพิ่มแล้ว"
 * ลูกค้าจ่ายเงินแล้วใช้ไม่ได้ และระบบไม่มีทางรู้ตัวเองเลย
 * (เจอจริง 3 พ.ย. 69 — phongth_wang · p_f123 · Puchan07 ตอนคอมเฟิร์สออฟไลน์ 7 ชม.
 *  ทั้งสามคนฐานข้อมูลบอกว่าเรียบร้อย ต้องให้ลูกค้าทักมาเองถึงรู้)
 *
 * grantedUntil เป็น NULL แปลว่าไม่รู้ (แถวเก่าก่อนมีคอลัมน์นี้) ให้สั่งซ้ำหนึ่งรอบ
 * เพื่อให้สองฝั่งตรงกัน บอทรับคำสั่งเพิ่มซ้ำได้อยู่แล้ว (เป็น "เพิ่มและต่ออายุ")
 */
async function resyncOutOfDateGrants(waitMinutes: number, queue: number | null): Promise<number> {
  // ทำเฉพาะตอนบอทว่าง — คนที่เพิ่งจ่ายเงินแล้วรออยู่ต้องได้คิวก่อน
  if (queue !== 0) return 0;

  const now = new Date();
  const redispatchCutoff = new Date(now.getTime() - waitMinutes * 60_000);

  const rows = await prisma.accessGrant.findMany({
    where: {
      status: "GRANTED",
      AND: [
        { OR: [{ lastDispatchedAt: null }, { lastDispatchedAt: { lt: redispatchCutoff } }] },
        withinFailBudget(now.getTime()),
      ],
      user: {
        tradingViewUsername: { not: null },
        subscriptions: { some: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gt: now } } },
      },
    },
    select: {
      id: true,
      userId: true,
      grantedUntil: true,
      user: {
        select: {
          subscriptions: {
            where: { status: { in: ACTIVE_STATUSES }, currentPeriodEnd: { gt: now } },
            select: { currentPeriodEnd: true },
            orderBy: { currentPeriodEnd: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { grantedAt: "asc" },
    take: MAX_RESYNC_PER_RUN * 4,
  });

  const tolerance = RESYNC_TOLERANCE_HOURS * 3_600_000;
  const behind = rows
    .filter((g) => {
      const paidUntil = g.user.subscriptions[0]?.currentPeriodEnd;
      if (!paidUntil) return false;
      if (g.grantedUntil === null) return true; // ไม่รู้ = ต้องทำให้รู้
      return g.grantedUntil.getTime() + tolerance < paidUntil.getTime();
    })
    .slice(0, MAX_RESYNC_PER_RUN);

  let done = 0;
  for (const g of behind) {
    try {
      await prisma.accessGrant.update({
        where: { id: g.id },
        data: { lastDispatchedAt: new Date() },
      });
      await syncTradingViewGrant(g.userId);
      done += 1;
    } catch (e) {
      console.error("reconcile: resync grant failed", g.id, e);
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
    invitesStale: 0,
    waitingForUsername: 0,
    healed: 0,
    resynced: 0,
    systemicFound: 0,
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

  const [grantsRetried, revokesRetried, invites, waitingForUsername] = await Promise.all([
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
          return { created: 0, stale: 0 };
        })
      : Promise.resolve({ created: 0, stale: 0 }),
    countWaitingForUsername(cutoff).catch(() => 0),
  ]);

  // ไล่ให้ TradingView ตรงกับที่ลูกค้าจ่าย — ทำหลังคิวปกติ และเฉพาะตอนบอทว่าง
  const resynced = await resyncOutOfDateGrants(waitMinutes, queue).catch((e) => {
    console.error("reconcile: resync step failed", e);
    return 0;
  });

  // ดูภาพรวมหลังสั่งงานรอบนี้เสร็จ — ตัวเลขจะได้รวมผลล่าสุดด้วย
  const systemic = await reportSystemicFailures().catch((e) => {
    console.error("reconcile: systemic check failed", e);
    return { found: 0, sent: 0, reasons: [] as string[] };
  });

  return {
    grantsRetried,
    revokesRetried,
    invitesCreated: invites.created,
    invitesStale: invites.stale,
    waitingForUsername,
    healed: healed.grants,
    resynced,
    systemicFound: systemic.found,
    systemicAlerts: systemic.sent,
    ...(systemic.reasons.length > 0 ? { systemicNotSent: systemic.reasons } : {}),
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
export interface SystemicGroup {
  reason: string;
  members: number;
  grants: number;
  revokes: number;
  sample: string[];
}

/**
 * หากลุ่มความล้มเหลวที่กว้างพอจะถือว่าเป็นของส่วนกลาง — อ่านอย่างเดียว ไม่ส่งอะไร
 *
 * แยกจากตัวส่งแจ้งเตือนโดยตั้งใจ เครื่องมือวินิจฉัยต้องส่องได้โดยไม่ต้องยิงของจริง
 * ไม่งั้นวิธีเดียวที่จะรู้ว่าด่านนี้ทำงานไหม คือรอให้มันเด้งเข้ากลุ่มแอดมิน
 */
export async function findSystemicFailures(): Promise<SystemicGroup[]> {
  const stuck = await prisma.accessGrant.findMany({
    where: {
      status: { in: ["PENDING", "PENDING_REVOKE"] },
      failCount: { gte: MAX_FAILS },
      lastFailReason: { not: null },
    },
    select: {
      status: true,
      lastFailReason: true,
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

  return Array.from(byReason.entries())
    .filter(([, rows]) => rows.length >= SYSTEMIC_FAIL_MEMBERS)
    .map(([reason, rows]) => ({
      reason,
      members: rows.length,
      grants: rows.filter((r) => r.status === "PENDING").length,
      revokes: rows.filter((r) => r.status === "PENDING_REVOKE").length,
      sample: rows.slice(0, 5).map((r) => r.user.tradingViewUsername ?? r.user.email ?? "-"),
    }))
    .sort((a, b) => b.members - a.members);
}

/**
 * เตือนกลุ่มที่พบ แล้วบอกว่าส่งออกไปได้จริงกี่กลุ่ม
 *
 * คืน sent แยกจาก found โดยตั้งใจ — "เจอ 3 กลุ่ม ส่งออกได้ 0" คือข้อมูลคนละชุด
 * กับ "ไม่เจออะไรเลย" และเป็นข้อมูลที่ต้องเห็น เพราะกรณีแรกแปลว่าท่อแจ้งเตือนพัง
 * ซึ่งอันตรายกว่าของที่มันพยายามจะเตือนเสียอีก
 */
async function reportSystemicFailures(): Promise<{
  found: number;
  sent: number;
  reasons: string[];
}> {
  const groups = await findSystemicFailures();
  let sent = 0;
  /**
   * เก็บเหตุผลที่ "ไม่ได้ส่ง" ไว้ด้วย
   *
   * ส่งไม่ออกกับโดนกันซ้ำให้ตัวเลขเดียวกันคือ 0 แต่เป็นคนละเรื่องกันสิ้นเชิง
   * อันแรกคือท่อแจ้งเตือนพัง อันหลังคือระบบทำงานถูกต้อง
   * ถ้าไม่บอกออกมา วิธีเดียวที่จะรู้คือไปเปิดห้องแอดมินดูด้วยตาเอง
   * ซึ่งแปลว่าเครื่องมือวินิจฉัยต้องพึ่งคน — ผิดตั้งแต่ต้น
   */
  const reasons: string[] = [];

  for (const g of groups) {
    const text =
      `🔴 ส่งมอบล้มเหลวเป็นวงกว้าง ${g.members} ราย — เหตุผลเดียวกันทุกคน\n` +
      `"${g.reason}"\n` +
      `แยกเป็น: ให้สิทธิ์ค้าง ${g.grants} · ถอนสิทธิ์ค้าง ${g.revokes}\n` +
      `ตัวอย่าง: ${g.sample.join(", ")}\n\n` +
      `หลายคนพังด้วยข้อความเดียวกัน = ต้นเหตุอยู่ที่ส่วนกลาง ไม่ใช่ที่ลูกค้า\n` +
      `เช็กตามลำดับ: บอทยัง login TradingView อยู่ไหม · selector ในกล่อง` +
      `จัดการการเข้าถึงเปลี่ยนหรือยัง (ดู bot_out.log) · บริดจ์ตัวไหนรับงานอยู่`;

    const res = await sendAdminAlertThrottled(`systemic-fail:${g.reason}`, text).catch((e) => {
      console.error("reconcile: systemic alert failed", e);
      return { sent: false, suppressed: 0, reason: e instanceof Error ? e.message : "unknown" };
    });
    if (res.sent) sent += 1;
    else reasons.push(res.reason ?? "ไม่ได้บอกเหตุผล");
  }
  return { found: groups.length, sent, reasons };
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
    /** กลุ่มความล้มเหลวที่กว้างพอจะถือว่าเป็นของส่วนกลาง — ส่องได้โดยไม่ต้องยิงแจ้งเตือน */
    systemicGroups: await findSystemicFailures(),
    /** คิวถอนที่ค้างอยู่บนคนที่ยังจ่ายเงินอยู่ = ระเบิดเวลา ต้องเป็น 0 */
    revokeOnActiveMember: revokeRows.filter((r) => r.verdict.startsWith("ข้าม — แพ็กเกจยังใช้งานอยู่")).length,
    duplicateQueues,
    grants: rows,
    // ตัดให้พอเห็นรูปแบบ ไม่งั้น JSON ยาวจนอ่านในเทอร์มินัลไม่ไหวตอนคิวบวม
    revokes: revokeRows.slice(0, 20),
  };
}
