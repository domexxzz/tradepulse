import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activateMembership } from "@/lib/lifecycle";
import { getUserSubscription } from "@/lib/subscription";
import { sendAdminAlert } from "@/lib/telegram";
import { BROKER_APPLICATION_STATUS as S } from "@/config/status";
import {
  BROKER_RENEWAL_WINDOW_DAYS,
  BROKER_REJECTION_REASONS,
  TRADING_ACCOUNT_RE,
  getBroker,
  isRejectionReason,
} from "@/config/brokers";

/** ชุดเดียวกับหน้า /account/tradingview — คนละกติกาเมื่อไหร่ ลูกค้าจะกรอกผ่านที่หนึ่งแต่ไม่ผ่านอีกที่ */
const TRADINGVIEW_USERNAME_RE = /^[a-zA-Z0-9_]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ทางที่ 2 ของการได้อินดิเคเตอร์ — เปิดพอร์ตกับโบรกผ่านลิงก์ QVX แทนการจ่ายเงิน
 *
 * ทั้งไฟล์นี้มีหน้าที่เดียวคือ "ตัดสินว่าจะเปิดสิทธิ์ให้ไหม"
 * ส่วนการเปิดสิทธิ์จริงยกให้ activateMembership ตัวเดียวกับทางจ่ายเงิน
 * ได้บอท TradingView · Telegram · Discord · การหมดอายุ ครบเหมือนกันโดยไม่ต้องเขียนซ้ำ
 *
 * แยกออกจาก server action เพื่อให้ชุด UAT เรียกตรงกับฐานข้อมูลจริงได้
 */

/** ระยะสิทธิ์ต่อรอบ — 1 เดือนตามปฏิทิน ใช้แพ็กเกจ MONTH ที่มีเทสต์เรื่องสิ้นเดือนครบแล้ว */
export const BROKER_PLAN_CODE = "MONTH";

/** คำขอที่ค้าง REVIEWING นานเกินนี้ถือว่าขั้นอนุมัติตายกลางทาง ให้กดอนุมัติใหม่ได้ */
const STALE_REVIEWING_MS = 5 * 60_000;

export type BrokerResult = { ok: true; id: string } | { ok: false; error: string };

export const accountKey = (broker: string, account: string) => `${broker}:${account}`;

/** ตัดช่องว่างที่ติดมาตอนก๊อป แต่ไม่ตัดเลข 0 นำหน้า */
export const normalizeAccount = (raw: string) => raw.replace(/\s+/g, "");

/**
 * เช็คว่าตอนนี้เปิดสิทธิ์ให้คนนี้ได้ไหม — ใช้ทั้งตอนส่งคำขอและตอนอนุมัติ
 *
 * ต้องเช็คซ้ำตอนอนุมัติด้วย ไม่ใช่แค่ตอนส่ง: ถ้ามีคำขอค้างสองอัน (ส่งซ้ำ / ระหว่างรอ
 * ลูกค้าไปจ่ายเงินทางที่ 1) อนุมัติอันแรกแล้วสิทธิ์จะเหลือ ~30 วัน อันที่สองต้องไม่ผ่าน
 * ไม่งั้นแอดมินกดอนุมัติสองรอบ ลูกค้าได้ฟรีสองเดือน
 */
async function renewalBlock(userId: string): Promise<string | null> {
  const { isActive, daysLeft } = await getUserSubscription(userId);
  if (isActive && daysLeft !== null && daysLeft > BROKER_RENEWAL_WINDOW_DAYS) {
    return `ยังมีสิทธิ์ใช้งานอีก ${daysLeft} วัน — ขอต่ออายุได้เมื่อเหลือไม่เกิน ${BROKER_RENEWAL_WINDOW_DAYS} วัน`;
  }
  return null;
}

export async function submitBrokerApplication(input: {
  userId: string;
  broker: string;
  tradingAccount: string;
  /**
   * กรอกมาในฟอร์มเดียวกับเลขบัญชี — ของเดิมบังคับให้ไปกรอกหน้าอื่นก่อน
   * ลูกค้าจึงเจอหน้าว่างที่มีแต่ปุ่ม "ไปกรอก TradingView username"
   * โดยยังไม่ทันเห็นเงื่อนไขหรือลิงก์เปิดบัญชีเลย
   * ไม่ส่งมา = ใช้ค่าที่เคยบันทึกไว้ในบัญชี (คำขอต่ออายุไม่ต้องพิมพ์ซ้ำ)
   */
  tradingViewUsername?: string;
  /** อีเมลที่ใช้เปิดบัญชีกับโบรก อาจคนละตัวกับอีเมลที่สมัคร QVX */
  brokerEmail?: string;
}): Promise<BrokerResult> {
  const broker = getBroker(input.broker);
  if (!broker) return { ok: false, error: "ไม่รู้จักโบรกนี้" };

  const account = normalizeAccount(input.tradingAccount);
  if (!TRADING_ACCOUNT_RE.test(account)) {
    return { ok: false, error: "เลขบัญชีเทรดต้องเป็นตัวเลขล้วน 4–20 หลัก" };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { tradingViewUsername: true, email: true, name: true },
  });
  if (!user) return { ok: false, error: "ไม่พบบัญชีผู้ใช้" };

  const typed = (input.tradingViewUsername ?? "").trim();
  // ตรวจเฉพาะค่าที่เพิ่งพิมพ์เข้ามา ไม่ตรวจค่าที่เก็บไว้ในบัญชีอยู่แล้ว
  // ของเก่าผ่านการตรวจตอนกรอกครั้งแรกไปแล้ว หรือแอดมินตั้งให้เองโดยตั้งใจ
  // ถ้ามาตรวจซ้ำตรงนี้ สมาชิกเดิมที่ชื่อไม่ตรงกฎจะขอต่ออายุไม่ได้
  // ทั้งที่ระบบใช้ชื่อนั้นเพิ่มสิทธิ์ให้เขาได้ตามปกติ
  if (typed && !TRADINGVIEW_USERNAME_RE.test(typed)) {
    return { ok: false, error: "TradingView username ใช้ได้เฉพาะ a-z, 0-9 และ _ (3–40 ตัว)" };
  }
  const tvUsername = typed || user.tradingViewUsername;
  if (!tvUsername) {
    // ยังต้องมีตั้งแต่ตอนส่ง — อนุมัติแล้วบอทต้องรู้ทันทีว่าจะเพิ่มสิทธิ์ให้ใคร
    return { ok: false, error: "กรอก TradingView username ด้วย" };
  }

  const brokerEmail = (input.brokerEmail ?? "").trim() || null;
  if (brokerEmail && !EMAIL_RE.test(brokerEmail)) {
    return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  }

  const pending = await prisma.brokerApplication.findFirst({
    where: { userId: input.userId, status: { in: [S.PENDING, S.REVIEWING] } },
    select: { id: true },
  });
  if (pending) return { ok: false, error: "มีคำขอรอตรวจอยู่แล้ว รอทีมงานตรวจสอบก่อน" };

  // บัญชีนี้ผูกกับคนอื่นไปแล้ว (ผ่านการอนุมัติมาก่อน) — บอกตั้งแต่ตอนส่ง ไม่ต้องรอแอดมิน
  const owner = await prisma.user.findFirst({
    where: { brokerAccountKey: accountKey(broker.id, account), NOT: { id: input.userId } },
    select: { id: true },
  });
  if (owner) return { ok: false, error: "เลขบัญชีนี้ถูกใช้รับสิทธิ์ไปแล้ว" };

  const blocked = await renewalBlock(input.userId);
  if (blocked) return { ok: false, error: blocked };

  // เขียนกลับเข้าบัญชีด้วย เพราะตอนอนุมัติบอทอ่าน tradingViewUsername จาก User ไม่ใช่จากคำขอ
  // ถ้าไม่เขียน คนที่กรอกชื่อครั้งแรกในฟอร์มนี้จะถูกเพิ่มสิทธิ์ให้บัญชีว่าง
  if (tvUsername !== user.tradingViewUsername) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { tradingViewUsername: tvUsername },
    });
    await prisma.accessGrant.updateMany({
      where: { userId: input.userId, status: "PENDING" },
      data: { tradingViewUsername: tvUsername },
    });
  }

  const { isActive } = await getUserSubscription(input.userId);
  const created = await prisma.brokerApplication.create({
    data: {
      userId: input.userId,
      broker: broker.id,
      tradingAccount: account,
      tradingViewUsername: tvUsername,
      brokerEmail,
      isRenewal: isActive,
    },
    select: { id: true },
  });

  // แจ้งแอดมินทันที ไม่ต้องคอยเปิดหน้าคิวเช็คเอง — ส่งไม่ได้ก็ไม่ทำให้คำขอพัง
  try {
    await sendAdminAlert(
      `🏦 คำขอ${isActive ? "ต่ออายุ" : "รับสิทธิ์"}ผ่าน ${broker.name}
สมาชิก: ${user.name ?? user.email ?? input.userId}
เลขบัญชี: ${account}${brokerEmail ? `\nอีเมลที่โบรก: ${brokerEmail}` : ""}
TradingView: ${tvUsername}
ตรวจแล้วกดอนุมัติที่ /admin/wisdom`
    );
  } catch {}

  return { ok: true, id: created.id };
}

export async function approveBrokerApplication(input: {
  applicationId: string;
  adminId: string;
}): Promise<BrokerResult> {
  const staleBefore = new Date(Date.now() - STALE_REVIEWING_MS);

  // จองคำขอไว้ก่อนเปิดสิทธิ์ — มีแค่คำขอเดียวที่เปลี่ยนสถานะได้ กดซ้ำจะได้ 0 แถว
  const claimed = await prisma.brokerApplication.updateMany({
    where: {
      id: input.applicationId,
      OR: [
        { status: S.PENDING },
        { status: S.REVIEWING, updatedAt: { lt: staleBefore } },
      ],
    },
    data: { status: S.REVIEWING },
  });
  if (claimed.count === 0) return { ok: false, error: "คำขอนี้ถูกตรวจไปแล้ว" };

  const app = await prisma.brokerApplication.findUniqueOrThrow({ where: { id: input.applicationId } });
  const release = () =>
    prisma.brokerApplication.update({ where: { id: app.id }, data: { status: S.PENDING } });

  const blocked = await renewalBlock(app.userId);
  if (blocked) {
    await release();
    return { ok: false, error: `${blocked} — ถ้าเป็นคำขอซ้ำ ให้กดปฏิเสธ` };
  }

  // ผูกเลขบัญชีกับสมาชิก — unique ของฐานข้อมูลเป็นตัวตัดสินสุดท้าย ไม่ใช่การเช็คในโค้ด
  try {
    await prisma.user.update({
      where: { id: app.userId },
      data: { brokerAccountKey: accountKey(app.broker, app.tradingAccount) },
    });
  } catch (e) {
    await release();
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "เลขบัญชีนี้ผูกกับสมาชิกคนอื่นแล้ว — ให้ปฏิเสธด้วยเหตุผล บัญชีซ้ำ" };
    }
    throw e;
  }

  try {
    await activateMembership({
      userId: app.userId,
      planCode: BROKER_PLAN_CODE,
      amountTHB: 0,
      providerRef: `broker_${app.id}`,
      provider: app.broker,
      source: getBroker(app.broker)?.name ?? app.broker,
    });
  } catch (e) {
    await release();
    throw e;
  }

  await prisma.brokerApplication.update({
    where: { id: app.id },
    data: { status: S.APPROVED, reviewedById: input.adminId, reviewedAt: new Date() },
  });
  return { ok: true, id: app.id };
}

export async function rejectBrokerApplication(input: {
  applicationId: string;
  adminId: string;
  reason: string;
  note?: string;
}): Promise<BrokerResult> {
  if (!isRejectionReason(input.reason)) return { ok: false, error: "เลือกเหตุผลที่ปฏิเสธ" };

  const note = input.note?.trim() || null;
  if (input.reason === "OTHER" && !note) {
    return { ok: false, error: "เลือก เหตุผลอื่น ต้องเขียนข้อความถึงลูกค้าด้วย" };
  }

  const done = await prisma.brokerApplication.updateMany({
    where: { id: input.applicationId, status: S.PENDING },
    data: {
      status: S.REJECTED,
      rejectionReason: input.reason,
      reviewNote: note,
      reviewedById: input.adminId,
      reviewedAt: new Date(),
    },
  });
  if (done.count === 0) return { ok: false, error: "คำขอนี้ถูกตรวจไปแล้ว" };
  return { ok: true, id: input.applicationId };
}

/** ข้อความที่ลูกค้าเห็นเมื่อถูกปฏิเสธ */
export function rejectionMessage(reason: string | null, note: string | null): string {
  if (reason === "OTHER" && note) return note;
  const base = reason && isRejectionReason(reason) ? BROKER_REJECTION_REASONS[reason] : "ไม่ผ่านการตรวจสอบ";
  return note ? `${base} (${note})` : base;
}

/**
 * สถานะคำขอของลูกค้าหนึ่งคน — ใช้ร่วมกันระหว่าง /account/wisdom กับ /activation
 * สองหน้าต้องตัดสินเหมือนกันว่าจะโชว์ฟอร์ม โชว์ "รอตรวจ" หรือบอกว่ายังขอต่ออายุไม่ได้
 * ถ้าต่างคนต่างเขียน วันหนึ่งหน้าหนึ่งจะเปิดฟอร์มให้ส่งซ้ำทั้งที่อีกหน้าบอกว่ารอตรวจอยู่
 */
export async function getBrokerApplicationView(userId: string, brokerId: string) {
  const [user, latest, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { tradingViewUsername: true, email: true } }),
    prisma.brokerApplication.findFirst({
      where: { userId, broker: brokerId },
      orderBy: { createdAt: "desc" },
    }),
    getUserSubscription(userId),
  ]);
  const { isActive, daysLeft } = subscription;

  return {
    user,
    latest,
    subscription,
    waiting: Boolean(latest && (latest.status === S.PENDING || latest.status === S.REVIEWING)),
    tooEarly: isActive && daysLeft !== null && daysLeft > BROKER_RENEWAL_WINDOW_DAYS,
  };
}
