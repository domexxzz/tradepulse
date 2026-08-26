import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { activateMembership, runMembershipMaintenance } from "@/lib/lifecycle";
import { getUserSubscription, isSubscriptionActive } from "@/lib/subscription";
import { addMonths, daysUntil } from "@/lib/date";
import { parseSlipDataUrl } from "@/lib/slip";

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
  it("เหลือ 5 วันแล้วต่อรายเดือน ต้องได้ ~35 วัน ไม่ใช่ 30", async () => {
    const user = await makeUser("renew");
    await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: `uat_r1_${user.id}`, provider: "web" });

    // บีบให้เหลือ 5 วัน
    const fiveDays = new Date(Date.now() + 5 * 864e5);
    await prisma.subscription.updateMany({ where: { userId: user.id }, data: { currentPeriodEnd: fiveDays } });

    const res = await activateMembership({ userId: user.id, planCode: "MONTH", amountTHB: 990, providerRef: `uat_r2_${user.id}`, provider: "line" });

    expect(res.extended).toBe(true);
    const left = daysUntil((await getUserSubscription(user.id)).sub!.currentPeriodEnd!);
    expect(left).toBeGreaterThanOrEqual(34);
    expect(left).toBeLessThanOrEqual(36);

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
