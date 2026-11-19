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
vi.mock("@/lib/alert-throttle", () => ({
  sendAdminAlertThrottled: (key: string, text: string) => {
    lastKey = key;
    alert(text);
    return Promise.resolve({ sent: true, suppressed: 0 });
  },
}));
let lastKey = "";

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

  it("เงียบนานจนถือว่าตาย — บอกด้วยว่าเงียบมากี่นาที และวิธีแก้ Chrome ค้างล็อก", async () => {
    health.mockResolvedValue({
      primary: { url: PRIMARY, up: false, silentMinutes: 780 },
      backup: { url: BACKUP, up: false },
    });
    await call();
    const msg = sent();
    expect(msg).toContain("เงียบติดต่อกันมาเกินครึ่งวัน");
    expect(msg).toContain("keeper.log");
    expect(msg).toContain("chromedriver.exe");
  });

  it("ล่มแบบไม่รู้ว่าเงียบมานานเท่าไหร่ — ไม่ขึ้นบรรทัดจำนวนนาทีเปล่า ๆ", async () => {
    health.mockResolvedValue({ primary: { url: PRIMARY, up: false }, backup: { url: BACKUP, up: false } });
    await call();
    expect(sent()).not.toContain("เงียบติดต่อกันมาแล้ว");
  });

  it("URL ในค่า env เพี้ยน ก็ยังส่งเตือนได้ ไม่ล้มทั้ง cron", async () => {
    health.mockResolvedValue({ primary: { url: "not a url", up: false }, backup: null });
    const res = await call();
    expect(res.status).toBe(200);
    expect(sent()).toContain("ค่า URL ไม่ถูกรูปแบบ");
  });
});

/**
 * ตัวกันซ้ำตัดสินจาก "เนื้อข้อความเหมือนเดิมไหม" ถ้าฝังตัวเลขที่เดินตลอด
 * ทุกข้อความจะต่างกันเสมอ แล้วแจ้งเตือนจะเด้งทุกรอบ cron ตลอดเวลาที่ยังไม่หาย
 * (เจอจริง 20 พ.ย. 69 — เด้ง 1881, 1888, 1894, 1899, 1906 นาที ไล่กันมา)
 */
describe("ข้อความต้องนิ่งพอให้ตัวกันซ้ำทำงาน", () => {
  it("เงียบนานขึ้นทีละไม่กี่นาที ต้องได้ข้อความเดิม", async () => {
    const texts: string[] = [];
    for (const silentMinutes of [1881, 1888, 1894, 1899, 1906]) {
      alert.mockClear();
      health.mockResolvedValue({
        primary: { url: PRIMARY, up: false, silentMinutes },
        backup: { url: BACKUP, up: true },
      });
      await call();
      texts.push(alert.mock.calls[0][0] as string);
    }
    expect(new Set(texts).size).toBe(1);
  });

  it("ตัวสำรองล่มตามไปด้วย = คนละสถานการณ์ ต้องใช้คีย์คนละอัน", async () => {
    health.mockResolvedValue({
      primary: { url: PRIMARY, up: false, silentMinutes: 100 },
      backup: { url: BACKUP, up: true },
    });
    await call();
    const withBackup = lastKey;
    health.mockResolvedValue({
      primary: { url: PRIMARY, up: false, silentMinutes: 100 },
      backup: { url: BACKUP, up: false },
    });
    await call();
    expect(lastKey).not.toBe(withBackup);
  });
});
