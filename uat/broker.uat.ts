import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  submitBrokerApplication,
  approveBrokerApplication,
  rejectBrokerApplication,
  rejectionMessage,
} from "@/lib/broker";
import { activateMembership } from "@/lib/lifecycle";
import { getUserSubscription } from "@/lib/subscription";
import { countPaidMembers } from "@/lib/pricing";
import { addMonths } from "@/lib/date";

/**
 * ทางที่ 2 — เปิดพอร์ตกับโบรกแทนการจ่ายเงิน · ชนฐานข้อมูลจริง
 *
 * ทางนี้ไม่มีเงินเข้า จุดที่พลาดแล้วเสียของจริงคือ "ให้สิทธิ์ฟรีเกินที่ควร"
 * อนุมัติซ้ำได้สองเดือน · บัญชีเดียวรับให้หลายคน · กินที่นั่งโปรของคนจ่ายเงิน
 * เทสต์ชุดนี้เน้นปิดทางเหล่านั้น
 */

const prisma = new PrismaClient();
const MARK = "uat-broker";
const ADMIN = "uat-admin";
let seq = 0;

async function makeUser(tag: string, tradingView: string | null = `tv_${tag}`) {
  return prisma.user.create({
    data: {
      email: `${tag}.${MARK}@uat.test`,
      name: `ทดสอบ ${tag}`,
      passwordHash: "x",
      tradingViewUsername: tradingView,
    },
  });
}

/** เลขบัญชีไม่ซ้ำกันระหว่างเคส — ไม่งั้นเคสหนึ่งผูกไว้แล้วอีกเคสจะล้มเพราะบัญชีซ้ำ */
const acct = () => `90${Date.now().toString().slice(-6)}${++seq}`;

async function submit(userId: string, tradingAccount = acct()) {
  return submitBrokerApplication({ userId, broker: "wisdom", tradingAccount });
}

async function submitOk(userId: string, tradingAccount = acct()) {
  const r = await submit(userId, tradingAccount);
  if (!r.ok) throw new Error(`ส่งคำขอไม่ผ่าน: ${r.error}`);
  return r.id;
}

/** ตั้งให้สิทธิ์ปัจจุบันเหลืออีก n วัน */
async function setDaysLeft(userId: string, days: number) {
  const { sub } = await getUserSubscription(userId);
  await prisma.subscription.update({
    where: { id: sub!.id },
    data: { currentPeriodEnd: new Date(Date.now() + days * 86_400_000) },
  });
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("B-1 · ส่งคำขอ", () => {
  it("ต้องกรอก TradingView username ก่อน — ไม่งั้นอนุมัติแล้วบอทไม่รู้จะเพิ่มให้ใคร", async () => {
    const u = await makeUser("no-tv", null);
    const r = await submit(u.id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("TradingView");
  });

  it("เลขบัญชีต้องเป็นตัวเลข และเก็บเลข 0 นำหน้าไว้ตามจริง", async () => {
    const u = await makeUser("format");
    expect((await submit(u.id, "12ab34")).ok).toBe(false);
    expect((await submit(u.id, "12")).ok).toBe(false);

    const id = await submitOk(u.id, " 0012 3456 ");
    const app = await prisma.brokerApplication.findUniqueOrThrow({ where: { id } });
    expect(app.tradingAccount).toBe("00123456");
    expect(app.status).toBe("PENDING");
    expect(app.tradingViewUsername).toBe("tv_format");
  });

  it("มีคำขอรอตรวจอยู่แล้ว ส่งซ้ำไม่ได้", async () => {
    const u = await makeUser("dup-pending");
    await submitOk(u.id);
    const again = await submit(u.id);
    expect(again.ok).toBe(false);
  });
});

describe("B-2 · อนุมัติ = ได้ครบเท่าคนจ่ายเงิน", () => {
  it("เปิดสิทธิ์ 1 เดือน ช่องทาง wisdom ไม่มีเงินเข้า ไม่กินที่นั่งโปร", async () => {
    const u = await makeUser("happy");
    const account = acct();
    const id = await submitOk(u.id, account);
    const seatsBefore = await countPaidMembers();
    const before = new Date();

    const r = await approveBrokerApplication({ applicationId: id, adminId: ADMIN });
    expect(r.ok).toBe(true);

    const { isActive, sub } = await getUserSubscription(u.id);
    expect(isActive).toBe(true);
    expect(sub?.planCode).toBe("MONTH");
    expect(sub?.currentPeriodEnd?.toDateString()).toBe(addMonths(before, 1).toDateString());

    // ไม่ได้จ่ายเงินเรา ต้องไม่มีใบเสร็จ และที่นั่งโปรของคนจ่ายเงินต้องไม่ลด
    expect(await prisma.payment.count({ where: { userId: u.id } })).toBe(0);
    expect(await countPaidMembers()).toBe(seatsBefore);

    // เข้าคิวบอท TradingView เหมือนสมาชิกจ่ายเงิน
    expect(await prisma.accessGrant.count({ where: { userId: u.id } })).toBeGreaterThan(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.brokerAccountKey).toBe(`wisdom:${account}`);

    const app = await prisma.brokerApplication.findUniqueOrThrow({ where: { id } });
    expect(app.status).toBe("APPROVED");
    expect(app.reviewedById).toBe(ADMIN);
  });
});

describe("B-3 · กันให้สิทธิ์ฟรีเกินที่ควร", () => {
  it("กดอนุมัติซ้ำ (ดับเบิลคลิก) ได้สิทธิ์แค่เดือนเดียว", async () => {
    const u = await makeUser("double");
    const id = await submitOk(u.id);

    const [a, b] = await Promise.all([
      approveBrokerApplication({ applicationId: id, adminId: ADMIN }),
      approveBrokerApplication({ applicationId: id, adminId: ADMIN }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

    const { sub } = await getUserSubscription(u.id);
    const expected = addMonths(new Date(), 1);
    expect(sub?.currentPeriodEnd?.toDateString()).toBe(expected.toDateString());
  });

  it("คำขอค้างสองอัน อนุมัติอันแรกแล้ว อันที่สองต้องไม่ผ่าน", async () => {
    const u = await makeUser("two-pending");
    const first = await submitOk(u.id);
    // จำลองคำขอที่หลุดมาอีกอัน (ส่งพร้อมกัน) — ข้ามด่านตอนส่งด้วยการสร้างตรง
    const second = await prisma.brokerApplication.create({
      data: { userId: u.id, broker: "wisdom", tradingAccount: acct(), tradingViewUsername: "tv_x" },
    });

    expect((await approveBrokerApplication({ applicationId: first, adminId: ADMIN })).ok).toBe(true);
    const r = await approveBrokerApplication({ applicationId: second.id, adminId: ADMIN });
    expect(r.ok).toBe(false);

    // อันที่สองกลับไปรอตรวจ ให้แอดมินกดปฏิเสธได้ ไม่ค้างอยู่กลางทาง
    const left = await prisma.brokerApplication.findUniqueOrThrow({ where: { id: second.id } });
    expect(left.status).toBe("PENDING");
  });

  it("บัญชีเทรดที่ผูกกับคนอื่นแล้ว คนใหม่ส่งคำขอไม่ได้", async () => {
    const a = await makeUser("owner-a");
    const b = await makeUser("owner-b");
    const shared = acct();
    await approveBrokerApplication({ applicationId: await submitOk(a.id, shared), adminId: ADMIN });

    const r = await submit(b.id, shared);
    expect(r.ok).toBe(false);
  });

  it("สองคนส่งเลขบัญชีเดียวกันก่อนมีใครได้อนุมัติ — อนุมัติได้คนเดียว", async () => {
    const a = await makeUser("race-a");
    const b = await makeUser("race-b");
    const shared = acct();
    const idA = await submitOk(a.id, shared);
    const idB = await submitOk(b.id, shared);

    expect((await approveBrokerApplication({ applicationId: idA, adminId: ADMIN })).ok).toBe(true);
    const r = await approveBrokerApplication({ applicationId: idB, adminId: ADMIN });
    expect(r.ok).toBe(false);
    expect((await getUserSubscription(b.id)).isActive).toBe(false);
  });
});

describe("B-4 · ต่ออายุ", () => {
  it("ยังเหลือเกิน 3 วัน ขอต่อไม่ได้", async () => {
    const u = await makeUser("renew-early");
    await approveBrokerApplication({ applicationId: await submitOk(u.id), adminId: ADMIN });
    const r = await submit(u.id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("3 วัน");
  });

  it("เหลือไม่เกิน 3 วัน ขอต่อได้ และต่อจากวันหมดอายุเดิม ไม่ใช่จากวันนี้", async () => {
    const u = await makeUser("renew-ok");
    const account = acct();
    await approveBrokerApplication({ applicationId: await submitOk(u.id, account), adminId: ADMIN });
    await setDaysLeft(u.id, 2);
    const oldEnd = (await getUserSubscription(u.id)).sub!.currentPeriodEnd!;

    const id = await submitOk(u.id, account);
    expect((await prisma.brokerApplication.findUniqueOrThrow({ where: { id } })).isRenewal).toBe(true);

    expect((await approveBrokerApplication({ applicationId: id, adminId: ADMIN })).ok).toBe(true);
    const newEnd = (await getUserSubscription(u.id)).sub!.currentPeriodEnd!;
    expect(newEnd.toDateString()).toBe(addMonths(oldEnd, 1).toDateString());
  });

  it("สมาชิกที่จ่ายเงินอยู่ (ทางที่ 1) และยังเหลือหลายวัน ขอทางโบรกซ้อนไม่ได้", async () => {
    const u = await makeUser("paid-first");
    await activateMembership({
      userId: u.id, planCode: "MONTH", amountTHB: 990, providerRef: `uat_${u.id}`, provider: "web",
    });
    expect((await submit(u.id)).ok).toBe(false);
  });
});

describe("B-5 · ปฏิเสธ", () => {
  it("ต้องเลือกเหตุผลที่รู้จัก", async () => {
    const u = await makeUser("reject-reason");
    const id = await submitOk(u.id);
    expect((await rejectBrokerApplication({ applicationId: id, adminId: ADMIN, reason: "มั่ว" })).ok).toBe(false);
  });

  it("เหตุผลอื่น ต้องเขียนข้อความถึงลูกค้า และลูกค้าเห็นข้อความนั้น", async () => {
    const u = await makeUser("reject-other");
    const id = await submitOk(u.id);
    expect((await rejectBrokerApplication({ applicationId: id, adminId: ADMIN, reason: "OTHER" })).ok).toBe(false);

    const r = await rejectBrokerApplication({
      applicationId: id, adminId: ADMIN, reason: "OTHER", note: "รบกวนส่งภาพหน้าบัญชี MT5 ทาง LINE",
    });
    expect(r.ok).toBe(true);
    const app = await prisma.brokerApplication.findUniqueOrThrow({ where: { id } });
    expect(rejectionMessage(app.rejectionReason, app.reviewNote)).toBe("รบกวนส่งภาพหน้าบัญชี MT5 ทาง LINE");
  });

  it("ปฏิเสธแล้วไม่ได้สิทธิ์ และส่งคำขอใหม่ได้", async () => {
    const u = await makeUser("reject-retry");
    const id = await submitOk(u.id);
    await rejectBrokerApplication({ applicationId: id, adminId: ADMIN, reason: "NOT_ELIGIBLE" });
    expect((await getUserSubscription(u.id)).isActive).toBe(false);
    expect((await submit(u.id)).ok).toBe(true);
  });

  it("อนุมัติไปแล้ว กดปฏิเสธทับไม่ได้", async () => {
    const u = await makeUser("reject-after");
    const id = await submitOk(u.id);
    await approveBrokerApplication({ applicationId: id, adminId: ADMIN });
    expect((await rejectBrokerApplication({ applicationId: id, adminId: ADMIN, reason: "NOT_ELIGIBLE" })).ok).toBe(false);
  });
});

describe("B-6 · อนุมัติตายกลางทาง", () => {
  it("ค้าง REVIEWING นานเกิน 5 นาที กดอนุมัติใหม่ได้", async () => {
    const u = await makeUser("stale");
    const id = await submitOk(u.id);
    // คอลัมน์เวลาของ Prisma เป็น timestamp ไม่มีโซน และ Prisma ถือว่าเป็น UTC
    // ส่วนฐานข้อมูลตั้งโซนเป็น Asia/Bangkok — ใช้ now() ตรง ๆ จะได้เวลาไทย แล้วเพี้ยนไป 7 ชั่วโมง
    await prisma.$executeRaw`UPDATE "BrokerApplication" SET status = 'REVIEWING', "updatedAt" = (now() AT TIME ZONE 'UTC') - interval '10 minutes' WHERE id = ${id}`;
    expect((await approveBrokerApplication({ applicationId: id, adminId: ADMIN })).ok).toBe(true);
  });

  it("เพิ่ง REVIEWING (อีกคนกำลังอนุมัติอยู่) กดซ้ำไม่ได้", async () => {
    const u = await makeUser("fresh-reviewing");
    const id = await submitOk(u.id);
    await prisma.brokerApplication.update({ where: { id }, data: { status: "REVIEWING" } });
    expect((await approveBrokerApplication({ applicationId: id, adminId: ADMIN })).ok).toBe(false);
  });
});
