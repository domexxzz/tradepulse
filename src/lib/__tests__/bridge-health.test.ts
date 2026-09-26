import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ข้อความเตือนบริดจ์ล่ม — แอดมินอ่านแล้วต้องไปกู้ถูกเครื่อง
 *
 * บั๊กที่เคยมีจริง: ย้ายเครื่องบอทหลักไปคอมเฟิร์สแล้ว แต่ข้อความยังบอกว่าตัวหลักคือ server-254
 * แอดมินได้เตือนแล้วไปกู้ผิดเครื่อง
 */

const health = vi.fn();
const alert = vi.fn();
vi.mock("@/lib/tradingview", () => ({ checkBridgeHealth: health }));
vi.mock("@/lib/telegram", () => ({ sendAdminAlert: alert }));

process.env.CRON_SECRET = "test-secret";
const { GET } = await import("@/app/api/cron/bridge-health/route");

const PRIMARY = "https://random-words.trycloudflare.com";
const BACKUP = "https://asus.example.ts.net";
const call = () =>
  GET(new Request("http://localhost/api/cron/bridge-health", { headers: { authorization: "Bearer test-secret" } }));
const sent = () => String(alert.mock.calls[0][0]);

beforeEach(() => {
  health.mockReset();
  alert.mockReset();
});

describe("bridge-health", () => {
  it("ไม่มี secret = ไม่เช็ก ไม่เตือน", async () => {
    const res = await GET(new Request("http://localhost/api/cron/bridge-health"));
    expect(res.status).toBe(401);
    expect(health).not.toHaveBeenCalled();
  });

  it("ตัวหลักปกติ = ไม่กวนแอดมิน", async () => {
    health.mockResolvedValue({ primary: { url: PRIMARY, up: true }, backup: { url: BACKUP, up: false } });
    await call();
    expect(alert).not.toHaveBeenCalled();
  });

  it("ล่มทั้งสองตัว — บอกชื่อเครื่องถูก และบอกโฮสต์ที่เว็บยิงไปจริง", async () => {
    health.mockResolvedValue({ primary: { url: PRIMARY, up: false }, backup: { url: BACKUP, up: false } });
    await call();
    const msg = sent();
    expect(msg).toContain("ตัวหลัก (คอมเฟิร์ส)");
    expect(msg).toContain("random-words.trycloudflare.com");
    expect(msg).toContain("asus.example.ts.net");
    expect(msg).not.toContain("server-254");
  });

  it("ตัวสำรองยังเปิด — บอกว่าระบบยังทำงาน ไม่สั่งให้ไปกู้เครื่อง", async () => {
    health.mockResolvedValue({ primary: { url: PRIMARY, up: false }, backup: { url: BACKUP, up: true } });
    await call();
    expect(sent()).toContain("สลับไปใช้ให้อัตโนมัติแล้ว");
    expect(sent()).not.toContain("ต้องทำ");
  });

  it("URL ในค่า env เพี้ยน ก็ยังส่งเตือนได้ ไม่ล้มทั้ง cron", async () => {
    health.mockResolvedValue({ primary: { url: "not a url", up: false }, backup: null });
    const res = await call();
    expect(res.status).toBe(200);
    expect(sent()).toContain("ค่า URL ไม่ถูกรูปแบบ");
  });
});
