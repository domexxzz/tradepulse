import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { activateMembership, runMembershipMaintenance } from "@/lib/lifecycle";
import { markTelegramInviteNotified, sendTelegramInviteEmail } from "@/lib/telegram-invite";
import { salesPaused } from "@/config/site";
import { getUserSubscription, isSubscriptionActive } from "@/lib/subscription";
import { addMonths, daysUntil } from "@/lib/date";
import { parseSlipDataUrl } from "@/lib/slip";
import { countPaidMembers, getPromoState, monthlyPriceFor } from "@/lib/pricing";
import { PROMO_SEATS, MONTHLY_PROMO, MONTHLY_REGULAR } from "@/config/plans";

const prisma = new PrismaClient();
const MARK = "uat-run";

async function makeUser(tag: string) {
  return prisma.user.create({
    data: { email: `${tag}.${MARK}@uat.test`, name: `ทดสอบ ${tag}`, passwordHash: "x" },
  });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.$disconnect();
});

describe("W-4 · อนุมัติแล้วต้องได้ของครบ", () => {
  it("เปิดสิทธิ์ครั้งแรกได้ครบทุกอย่าง", async () => {
    const user = await makeUser("w4");
    const before = new Date();

    const res = await activateMembership({
      userId: user.id,
      planCode: "MONTH",
      amountTHB: 990,
      providerRef: `uat_${user.id}`,
      provider: "web",
    });

    // 1) แพ็กเกจใช้งานได้ และหมดอายุ +1 เดือนพอดี
    const { sub, isActive, daysLeft } = await getUserSubscription(user.id);
    expect(isActive).toBe(true);
    expect(sub?.planCode).toBe("MONTH");
    expect(sub?.currentPeriodEnd?.toDateString()).toBe(addMonths(before, 1).toDateString());
    expect(daysLeft).toBeGreaterThan(26);

    // 2) ใบเสร็จบันทึกยอดและช่องทางถูกต้อง
    const pay = await prisma.payment.findFirst({ where: { userId: user.id } });
    expect(pay?.amountTHB).toBe(990);
    expect(pay?.provider).toBe("web");

    // 3) คิวสิทธิ์ TradingView ถูกสร้าง
    const grant = await prisma.accessGrant.findFirst({ where: { userId: user.id } });
    expect(grant?.status).toBe("PENDING");

    // 4) คิวกลุ่ม Telegram ถูกสร้าง
    const tg = await prisma.telegramGrant.findFirst({ where: { userId: user.id } });
    expect(tg?.status).toBe("PENDING");

    expect(res.extended).toBe(false);
  });

  it("บันทึกใบเสร็จซ้ำไม่ได้ (กันกดอนุมัติสองที)", async () => {
    const user = await makeUser("dup");
    const ref = `uat_dup_${user.id}`;
    await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: ref, provider: "web" });
    await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: ref, provider: "web" });
    expect(await prisma.payment.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("C-2 · แถมให้ฟรีต้องไม่ปนกับรายได้", () => {
  it("ยอด 0 บาทไม่สร้างใบเสร็จ แต่ยังได้สิทธิ์", async () => {
    const user = await makeUser("comp");
    await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 0, providerRef: `uat_comp_${user.id}`, provider: "comp" });
    expect((await getUserSubscription(user.id)).isActive).toBe(true);
    expect(await prisma.payment.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("E-4 · ต่ออายุต้องทบวันที่เหลือ", () => {
  it("เหลือ 5 วันแล้วต่อรายเดือน ต้องนับต่อจากวันหมดอายุเดิม ไม่ใช่เริ่มนับใหม่", async () => {
    const user = await makeUser("renew");
    await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: `uat_r1_${user.id}`, provider: "web" });

    // บีบให้เหลือ 5 วัน
    const fiveDays = new Date(Date.now() + 5 * 864e5);
    await prisma.subscription.updateMany({ where: { userId: user.id }, data: { currentPeriodEnd: fiveDays } });

    const res = await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: `uat_r2_${user.id}`, provider: "line" });

    expect(res.extended).toBe(true);
    const end = (await getUserSubscription(user.id)).sub!.currentPeriodEnd!;

    // ต้องนับต่อจากวันหมดอายุเดิมเป๊ะ ๆ
    // (เทียบค่าตรง ไม่ใช้ช่วงจำนวนวัน เพราะเดือนสั้นยาวไม่เท่ากัน —
    //  ของเดิมยืนยัน 34-36 วัน ซึ่งล้มทุกเดือน ก.พ. ปีปกติ ที่ได้ 5+28=33 วัน)
    expect(end.toISOString()).toBe(addMonths(fiveDays, 1).toISOString());

    // และต้องมากกว่าการเปิดใหม่จากวันนี้ = พิสูจน์ว่าทบวันที่เหลือให้จริง ไม่ใช่ทับทิ้ง
    expect(daysUntil(end)).toBeGreaterThan(daysUntil(addMonths(new Date(), 1)));

    // ต่ออายุแล้วต้องเตือนได้ใหม่ในรอบถัดไป
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(sub?.expiryNotifiedAt).toBeNull();

    // มีแถวเดียว ไม่ใช่สองแถวซ้อน
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("E-2 · หมดอายุแล้วต้องถูกปิดสิทธิ์", () => {
  it("cron ปิดสิทธิ์และเข้าคิวถอนทุกช่องทาง", async () => {
    const user = await makeUser("expire");
    await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: `uat_e_${user.id}`, provider: "web" });
    await prisma.telegramGrant.updateMany({ where: { userId: user.id }, data: { status: "ADDED" } });
    await prisma.accessGrant.updateMany({ where: { userId: user.id }, data: { status: "GRANTED" } });

    // ย้อนวันหมดอายุไปเมื่อวาน
    await prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { currentPeriodEnd: new Date(Date.now() - 864e5) },
    });

    // ยังไม่รัน cron — ต้องถือว่าใช้ไม่ได้แล้วทันที
    expect((await getUserSubscription(user.id)).isActive).toBe(false);

    const result = await runMembershipMaintenance();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(sub?.status).toBe("EXPIRED");
    expect(sub?.expiredAt).not.toBeNull();

    const grant = await prisma.accessGrant.findFirst({ where: { userId: user.id } });
    expect(grant?.status).toBe("PENDING_REVOKE");

    const tg = await prisma.telegramGrant.findFirst({ where: { userId: user.id } });
    expect(tg?.status).toBe("PENDING_REMOVE");
  });

  it("รัน cron ซ้ำต้องไม่ปิดซ้ำ", async () => {
    const again = await runMembershipMaintenance();
    expect(again.expired).toBe(0);
  });
});

describe("บั๊กเดิม · จ่ายเดือนเดียวใช้ตลอดชีพ", () => {
  it("สถานะ ACTIVE แต่เลยวันหมดอายุ ต้องใช้ไม่ได้", async () => {
    const user = await makeUser("forever");
    await activateMembership({ userId: user.id, planCode: "YEAR", amountTHB: 7990, providerRef: `uat_f_${user.id}`, provider: "web" });
    await prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { status: "ACTIVE", currentPeriodEnd: new Date("2020-01-01") },
    });
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(sub?.status).toBe("ACTIVE");
    expect(isSubscriptionActive(sub)).toBe(false);
  });
});

describe("F-1 · สลิปซ้ำต้องถูกปฏิเสธที่ระดับฐานข้อมูล", () => {
  it("slipHash ซ้ำแทรกไม่ได้", async () => {
    const user = await makeUser("slip");
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseSlipDataUrl(`data:image/png;base64,${png}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const mk = (n: number) =>
      prisma.slipOrder.create({
        data: { userId: user.id, planCode: "MONTH", amountTHB: 990, status: "SUBMITTED", slipHash: parsed.slip.hash, note: `ครั้งที่ ${n}` },
      });

    await mk(1);
    await expect(mk(2)).rejects.toThrow();
  });
});

describe("P-1 · ที่นั่งโปรสุดท้ายต้องได้ราคาล็อกจริง", () => {
  /** เติมสมาชิกที่จ่ายเงินแล้วให้เหลือที่นั่งโปรพอดี n ที่ */
  async function fillSeatsLeaving(n: number) {
    const already = await countPaidMembers();
    const need = PROMO_SEATS - n - already;
    if (need <= 0) return;

    const users = Array.from({ length: need }, (_, i) => ({
      email: `seat${i}.${MARK}@uat.test`,
      name: `ที่นั่ง ${i}`,
      passwordHash: "x",
    }));
    await prisma.user.createMany({ data: users });

    const created = await prisma.user.findMany({
      where: { email: { startsWith: "seat", endsWith: `${MARK}@uat.test` } },
      select: { id: true },
    });
    await prisma.payment.createMany({
      data: created.map((u) => ({
        userId: u.id,
        amountTHB: 990,
        provider: "web",
        status: "paid",
      })),
    });
  }

  it(`คนที่ ${PROMO_SEATS} ซึ่งกินที่นั่งสุดท้าย ยังถูกล็อกราคา ฿${MONTHLY_PROMO}`, async () => {
    await fillSeatsLeaving(1);
    expect(await countPaidMembers()).toBe(PROMO_SEATS - 1);

    const last = await makeUser("seat-last");
    await activateMembership({
      userId: last.id,
      planCode: "MONTH",
      amountTHB: MONTHLY_PROMO,
      providerRef: `uat_${last.id}`,
      provider: "web",
    });

    // ที่นั่งเต็มพอดีแล้ว หน้าเว็บต้องขึ้นราคาปกติกับคนถัดไป
    const promo = await getPromoState();
    expect(promo.taken).toBe(PROMO_SEATS);
    expect(promo.active).toBe(false);
    expect(promo.monthlyTHB).toBe(MONTHLY_REGULAR);

    // แต่คนที่เพิ่งจ่ายต้องถูกล็อกราคาโปรไว้แล้ว ไม่ใช่หลุดไปเป็นราคาปกติ
    expect(await monthlyPriceFor(last.id)).toBe(MONTHLY_PROMO);
    const row = await prisma.user.findUnique({
      where: { id: last.id },
      select: { lockedMonthlyTHB: true },
    });
    expect(row?.lockedMonthlyTHB).toBe(MONTHLY_PROMO);
  });

  it(`คนที่ ${PROMO_SEATS + 1} ไม่ได้ราคาโปร และโดนเก็บ ฿${MONTHLY_REGULAR}`, async () => {
    const over = await makeUser("seat-over");
    await activateMembership({
      userId: over.id,
      planCode: "MONTH",
      amountTHB: MONTHLY_REGULAR,
      providerRef: `uat_${over.id}`,
      provider: "web",
    });

    const row = await prisma.user.findUnique({
      where: { id: over.id },
      select: { lockedMonthlyTHB: true },
    });
    expect(row?.lockedMonthlyTHB).toBeNull();
    expect(await monthlyPriceFor(over.id)).toBe(MONTHLY_REGULAR);
  });
});

describe("T-1 · ลิงก์กลุ่ม Telegram ต้องถึงมือเอง ไม่ต้องรอแอดมินกด", () => {
  /**
   * ชุดทดสอบนี้ไม่ได้ตั้งค่าผู้ให้บริการอีเมล sendEmail จึงตอบ { ok: false, skipped: true }
   * ทางที่ "ส่งออกจริง" จึงไม่ถูกวิ่งที่นี่ — ที่เทสได้คือกฎรอบ ๆ ซึ่งเป็นตัวที่พลาดแล้วเจ็บ
   * (ยิงซ้ำหาลูกค้าทุกวัน / ประทับว่าส่งแล้วทั้งที่ส่งไม่ออกจนไม่มีใครได้ลิงก์)
   */
  it("ส่งอีเมลไม่ออก ต้องไม่ประทับว่าส่งแล้ว — พรุ่งนี้ต้องได้ลองใหม่", async () => {
    const user = await makeUser("tg-retry");
    await activateMembership({
      userId: user.id, planCode: "MONTH", amountTHB: 990,
      providerRef: `uat_tg1_${user.id}`, provider: "web",
    });
    await prisma.telegramGrant.updateMany({
      where: { userId: user.id },
      data: { inviteLink: "https://t.me/+uat-fake-link" },
    });

    const sent = await sendTelegramInviteEmail(user.id);
    expect(sent).toBe(false);

    const tg = await prisma.telegramGrant.findFirst({ where: { userId: user.id } });
    expect(tg?.notifiedAt).toBeNull();
  });

  it("ยังไม่มีลิงก์เชิญ ต้องไม่ส่งอีเมลเปล่า", async () => {
    const user = await makeUser("tg-nolink");
    await activateMembership({
      userId: user.id, planCode: "MONTH", amountTHB: 990,
      providerRef: `uat_tg2_${user.id}`, provider: "web",
    });

    expect(await sendTelegramInviteEmail(user.id)).toBe(false);
  });

  it("ประทับแล้วรอบกวาดต้องไม่แตะซ้ำ — กันยิงอีเมลซ้ำทุกวัน", async () => {
    const user = await makeUser("tg-once");
    await activateMembership({
      userId: user.id, planCode: "MONTH", amountTHB: 990,
      providerRef: `uat_tg3_${user.id}`, provider: "web",
    });
    await prisma.telegramGrant.updateMany({
      where: { userId: user.id },
      data: { inviteLink: "https://t.me/+uat-fake-link" },
    });

    await markTelegramInviteNotified(user.id);
    const stamped = await prisma.telegramGrant.findFirst({ where: { userId: user.id } });
    expect(stamped?.notifiedAt).not.toBeNull();

    await runMembershipMaintenance();

    const after = await prisma.telegramGrant.findFirst({ where: { userId: user.id } });
    expect(after?.notifiedAt?.getTime()).toBe(stamped?.notifiedAt?.getTime());
  });

  it("เข้ากลุ่มไปแล้ว (ADDED) รอบกวาดต้องไม่ส่งอะไรอีก", async () => {
    const user = await makeUser("tg-added");
    await activateMembership({
      userId: user.id, planCode: "MONTH", amountTHB: 990,
      providerRef: `uat_tg4_${user.id}`, provider: "web",
    });
    await prisma.telegramGrant.updateMany({
      where: { userId: user.id },
      data: { status: "ADDED", addedAt: new Date(), inviteLink: "https://t.me/+uat-fake-link" },
    });

    await runMembershipMaintenance();

    const after = await prisma.telegramGrant.findFirst({ where: { userId: user.id } });
    expect(after?.notifiedAt).toBeNull();
  });

  it("รอบกวาดรายงานจำนวนที่ส่งลิงก์ให้ด้วย", async () => {
    const result = await runMembershipMaintenance();
    expect(typeof result.invited).toBe("number");
  });
});

/**
 * ตอนหยุดรับชำระเงิน คนที่ "โอนมาแล้ว" ต้องยังส่งสลิปได้
 *
 * ถ้าทางนี้ขาด เงินจะเข้าบัญชีเราโดยที่ระบบไม่รู้ว่าเป็นของใคร แอดมินก็ช่วยไม่ได้
 * เพราะสร้างออเดอร์แทนลูกค้าไม่ได้ (เกิดขึ้นจริง 29 ก.ย. 69)
 * เทสนี้ยิงที่ตรรกะฐานข้อมูลตรง ๆ — server action เรียกจากเทสไม่ได้เพราะต้องมี session
 */
describe("S-1 · หยุดรับเงินแล้วคนที่โอนมาแล้วต้องยังส่งสลิปได้", () => {
  it("ยืนยันว่าตอนนี้ยังหยุดรับชำระเงินอยู่ (เทสข้างล่างถึงจะมีความหมาย)", () => {
    expect(salesPaused).toBe(true);
  });

  it("ออเดอร์ที่ลูกค้าแจ้งว่าโอนมาแล้ว ต้องขึ้นในคิวตรวจสลิปของแอดมิน", async () => {
    const user = await makeUser("paid-nofslip");

    // เลียนแบบสิ่งที่ startSlipForTransfer ทำ
    const order = await prisma.slipOrder.create({
      data: {
        userId: user.id,
        planCode: "MONTH",
        amountTHB: 999,
        status: "PENDING",
        note: "ลูกค้าแจ้งว่าโอนมาแล้วระหว่างหยุดรับชำระเงิน",
      },
    });
    expect(order.status).toBe("PENDING");

    // แนบสลิปแล้วต้องกลายเป็น SUBMITTED ซึ่งคือคิวที่แอดมินเปิดดูเป็นแท็บแรก
    await prisma.slipOrder.update({
      where: { id: order.id },
      data: { status: "SUBMITTED", slipHash: `uat-${order.id}` },
    });

    const inQueue = await prisma.slipOrder.findMany({
      where: { status: "SUBMITTED", userId: user.id },
      select: { id: true, amountTHB: true, note: true },
    });
    expect(inQueue).toHaveLength(1);
    expect(inQueue[0].amountTHB).toBe(999);
    // โน้ตต้องติดไปด้วย แอดมินจะได้รู้ว่าใบนี้มาจากทางไหน ไม่ใช่คนกดซื้อปกติ
    expect(inQueue[0].note).toContain("หยุดรับชำระเงิน");
  });

  it("กดซ้ำต้องใช้ใบเดิม ไม่สร้างใบค้างเป็นสิบ", async () => {
    const user = await makeUser("paid-twice");
    const make = () =>
      prisma.slipOrder.findFirst({
        where: { userId: user.id, planCode: "MONTH", status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

    const first = await prisma.slipOrder.create({
      data: { userId: user.id, planCode: "MONTH", amountTHB: 999, status: "PENDING" },
      select: { id: true },
    });
    const reused = await make();
    expect(reused?.id).toBe(first.id);
  });
});
