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
  if (!user.tradingViewUsername) {
    // ต้องมีตั้งแต่ตอนส่ง — อนุมัติแล้วบอทต้องรู้ทันทีว่าจะเพิ่มสิทธิ์ให้ใคร
    return { ok: false, error: "กรอก TradingView username ก่อน แล้วค่อยส่งคำขอ" };
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

  const { isActive } = await getUserSubscription(input.userId);
  const created = await prisma.brokerApplication.create({
    data: {
      userId: input.userId,
      broker: broker.id,
      tradingAccount: account,
      tradingViewUsername: user.tradingViewUsername,
      isRenewal: isActive,
    },
    select: { id: true },
  });

  // แจ้งแอดมินทันที ไม่ต้องคอยเปิดหน้าคิวเช็คเอง — ส่งไม่ได้ก็ไม่ทำให้คำขอพัง
  try {
    await sendAdminAlert(
      `🏦 คำขอ${isActive ? "ต่ออายุ" : "รับสิทธิ์"}ผ่าน ${broker.name}
สมาชิก: ${user.name ?? user.email ?? input.userId}
เลขบัญชี: ${account}
TradingView: ${user.tradingViewUsername}
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
