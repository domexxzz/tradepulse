import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * บอทรายงาน URL ของตัวเองเข้าเว็บ · ชนฐานข้อมูลจริง
 * ต้องได้: รายงานถูกต้องแล้วเว็บยิงไปที่ใหม่ทันที · secret ผิดเปลี่ยนไม่ได้ · เก่าแล้วกลับไปใช้ env
 */

process.env.TV_BOT_SECRET = "uat-bridge-secret";
process.env.TV_BOT_URL = "https://env-primary.trycloudflare.com";
process.env.TV_BOT_URL_BACKUP = "https://env-backup.trycloudflare.com";

const prisma = new PrismaClient();
const { POST } = await import("@/app/api/tradingview/register/route");
const { bridgeUrls, BRIDGE_FRESH_MS } = await import("@/lib/tradingview");

const register = (body: Record<string, unknown>) =>
  POST(new Request("http://localhost/api/tradingview/register", { method: "POST", body: JSON.stringify(body) }));

beforeEach(async () => {
  await prisma.bridgeEndpoint.deleteMany();
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "bridge-register:" } } });
});
beforeAll(async () => {
  await prisma.bridgeEndpoint.deleteMany();
});
afterAll(async () => {
  await prisma.bridgeEndpoint.deleteMany();
  await prisma.$disconnect();
});

describe("R-1 · รายงาน URL", () => {
  it("ไม่มีรายงาน = ใช้ env ตามเดิม", async () => {
    expect(await bridgeUrls()).toEqual({
      primary: "https://env-primary.trycloudflare.com",
      backup: "https://env-backup.trycloudflare.com",
    });
  });

  it("รายงานถูกต้อง = เว็บยิงไปที่ใหม่ทันที ไม่ต้อง redeploy", async () => {
    const res = await register({ secret: "uat-bridge-secret", role: "backup", url: "https://new-tunnel.trycloudflare.com/" });
    expect(res.status).toBe(200);
    const urls = await bridgeUrls();
    expect(urls.backup).toBe("https://new-tunnel.trycloudflare.com");
    expect(urls.primary).toBe("https://env-primary.trycloudflare.com");
  });

  it("secret ผิด = เปลี่ยนไม่ได้", async () => {
    const res = await register({ secret: "wrong", role: "primary", url: "https://attacker.trycloudflare.com" });
    expect(res.status).toBe(401);
    expect((await bridgeUrls()).primary).toBe("https://env-primary.trycloudflare.com");
  });

  it("URL นอก tunnel ที่อนุญาต = ปฏิเสธ แม้ secret ถูก", async () => {
    const res = await register({ secret: "uat-bridge-secret", role: "primary", url: "https://evil.com" });
    expect(res.status).toBe(400);
    expect(await prisma.bridgeEndpoint.count()).toBe(0);
  });

  it("เดา secret รัว ๆ โดนเบรก", async () => {
    for (let i = 0; i < 10; i++) await register({ secret: `guess${i}`, role: "primary", url: "https://x.trycloudflare.com" });
    const res = await register({ secret: "uat-bridge-secret", role: "primary", url: "https://x.trycloudflare.com" });
    expect(res.status).toBe(429);
  });

  it("รายงานเก่าเกิน 15 นาที (เครื่องดับ) = กลับไปใช้ env", async () => {
    await register({ secret: "uat-bridge-secret", role: "primary", url: "https://old.trycloudflare.com" });
    await prisma.bridgeEndpoint.update({
      where: { role: "primary" },
      data: { lastSeenAt: new Date(Date.now() - BRIDGE_FRESH_MS - 60_000) },
    });
    expect((await bridgeUrls()).primary).toBe("https://env-primary.trycloudflare.com");
  });
});
