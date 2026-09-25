import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { activateMembership, expireSubscriptionById } from "@/lib/lifecycle";
import { getUserSubscription } from "@/lib/subscription";

/**
 * API บอกสิทธิ์ให้ระบบพาร์ตเนอร์ — ชนฐานข้อมูลจริง
 *
 * มีไว้เพราะฝั่ง QVX AI จะเลิกถือ ai_entitlements ของตัวเองแล้วมาถามที่นี่แทน
 * ถ้า endpoint นี้ตอบผิด ลูกค้าที่หมดอายุจะยังใช้ AI ได้ต่อ ซึ่งคือบั๊กเดิมที่
 * เรากำลังจะแก้ให้เขา เทสต์ชุดนี้จึงเน้นเคส "หมดอายุแล้วต้องตอบว่าไม่ active"
 *
 * เรียกฟังก์ชัน POST ของ route ตรง ๆ ไม่ต้องยก Next server ขึ้นมา
 */

const prisma = new PrismaClient();
const MARK = "uat-ent";
const SECRET = "uat-partner-secret-do-not-use-in-production";

// ต้องตั้งก่อน import route เพราะ route อ่าน env ตอนเรียกใช้
process.env.PARTNER_API_SECRET = SECRET;

const { POST } = await import("@/app/api/entitlement/route");

function ask(email: string, secret: string = SECRET) {
  return POST(
    new Request("http://localhost/api/entitlement", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email }),
    })
  );
}

async function makeUser(tag: string) {
  return prisma.user.create({
    data: { email: `${tag}.${MARK}@uat.test`, name: `ทดสอบ ${tag}`, passwordHash: "x" },
  });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "entitlement:" } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "entitlement:" } } });
  await prisma.$disconnect();
});

describe("E-1 · สมาชิกที่ยังไม่หมดอายุ", () => {
  it("ตอบ active พร้อมวันหมดอายุและชื่อแพ็กเกจ", async () => {
    const user = await makeUser("active");
    await activateMembership({
      userId: user.id,
      planCode: "MONTH",
      amountTHB: 990,
      providerRef: `uat_${user.id}`,
      provider: "web",
    });

    const body = await (await ask(user.email!)).json();

    expect(body.active).toBe(true);
    expect(body.plan).toEqual({ code: "MONTH", name: "รายเดือน" });
    expect(body.daysLeft).toBeGreaterThan(26);

    // วันหมดอายุต้องตรงกับที่ฐานข้อมูลเก็บจริง ไม่ใช่ค่าที่คำนวณคนละทาง
    const { sub } = await getUserSubscription(user.id);
    expect(body.until).toBe(sub!.currentPeriodEnd!.toISOString());
  });
});

describe("E-2 · สมาชิกที่หมดอายุแล้ว — เคสที่บั๊กฝั่งโน้นพลาด", () => {
  it("ตอบ active:false และไม่คืนวันหมดอายุกับแพ็กเกจ", async () => {
    const user = await makeUser("expired");
    const res = await activateMembership({
      userId: user.id,
      planCode: "MONTH",
      amountTHB: 990,
      providerRef: `uat_${user.id}`,
      provider: "web",
    });

    const before = await (await ask(user.email!)).json();
    expect(before.active).toBe(true);

    await expireSubscriptionById(res.subscriptionId);

    const after = await (await ask(user.email!)).json();
    expect(after.active).toBe(false);
    expect(after.until).toBeNull();
    expect(after.daysLeft).toBeNull();
    expect(after.plan).toBeNull();
  });
});

describe("E-3 · ไม่เปิดช่องให้ไล่เช็คว่าอีเมลไหนเป็นลูกค้า", () => {
  it("อีเมลที่ไม่มีในระบบ ตอบรูปแบบเดียวกับคนที่หมดอายุเป๊ะ", async () => {
    const user = await makeUser("shape");
    const res = await activateMembership({
      userId: user.id,
      planCode: "MONTH",
      amountTHB: 990,
      providerRef: `uat_${user.id}`,
      provider: "web",
    });
    await expireSubscriptionById(res.subscriptionId);

    const expired = await (await ask(user.email!)).json();
    const unknown = await (await ask(`nobody.${MARK}@uat.test`)).json();

    expect(unknown).toEqual(expired);
  });
});

describe("E-4 · ความปลอดภัย", () => {
  it("secret ผิดต้องได้ 401 และไม่หลุดข้อมูลสิทธิ์", async () => {
    const user = await makeUser("wrongsecret");
    await activateMembership({
      userId: user.id,
      planCode: "YEAR",
      amountTHB: 7990,
      providerRef: `uat_${user.id}`,
      provider: "web",
    });

    const res = await ask(user.email!, "wrong-secret-same-length-ish");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("secret ยาวไม่เท่ากันก็ต้องไม่ผ่าน (timingSafeEqual โยนถ้าความยาวต่าง)", async () => {
    const res = await ask(`short.${MARK}@uat.test`, "x");
    expect(res.status).toBe(401);
  });

  it("อีเมลผิดรูปแบบได้ 400 ไม่ใช่ 500", async () => {
    const res = await POST(
      new Request("http://localhost/api/entitlement", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
        body: JSON.stringify({ email: "ไม่ใช่อีเมล" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("ไม่ได้ตั้ง PARTNER_API_SECRET = ปิดตาย ไม่ใช่เปิดโล่ง", async () => {
    const saved = process.env.PARTNER_API_SECRET;
    delete process.env.PARTNER_API_SECRET;
    try {
      const res = await ask(`anyone.${MARK}@uat.test`, "any-secret");
      expect(res.status).toBe(503);
    } finally {
      process.env.PARTNER_API_SECRET = saved;
    }
  });
});
