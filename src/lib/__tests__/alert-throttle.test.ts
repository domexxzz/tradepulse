import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ด่านสุดท้ายกันแจ้งเตือนซ้ำถล่มกลุ่มแอดมิน
 *
 * ทำไมต้องมีเทสต์: ตัวกันเตือนซ้ำพังมาแล้วสองรอบด้วยสาเหตุคนละอย่าง (รอบแรกเทียบ
 * เวลาจากคอลัมน์ที่ไม่ขยับ รอบสองมีโค้ดอีกบรรทัดล้างค่าที่ใช้เทียบทิ้งก่อนเสมอ)
 * ทั้งสองรอบจบลงที่แอดมินได้ข้อความเดิมทุก 15 นาทีติดกันหลายวันจนเลิกอ่านกลุ่ม
 * ซึ่งอันตรายกว่าไม่มีแจ้งเตือนเลย เพราะเรื่องจริงจะจมหายไปในกองข้อความซ้ำ
 *
 * เทสต์นี้ล็อกทั้งสองด้าน — กันซ้ำต้องได้ผล และต้องไม่กลบเรื่องใหม่
 */

const findUnique = vi.fn();
const update = vi.fn();
const upsert = vi.fn();
const sendAdminAlert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alertThrottle: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}));
vi.mock("@/lib/telegram", () => ({ sendAdminAlert: (...a: unknown[]) => sendAdminAlert(...a) }));

const { sendAdminAlertThrottled } = await import("@/lib/alert-throttle");

const TEXT = "⚠️ บอท TradingView ให้สิทธิ์ไม่สำเร็จ\nTradingView: @Kiadthawee";
const sentText = () => sendAdminAlert.mock.calls[0]?.[0] as string;

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
  update.mockResolvedValue({});
  upsert.mockResolvedValue({});
  sendAdminAlert.mockResolvedValue({ sent: true });
});

describe("sendAdminAlertThrottled", () => {
  it("ครั้งแรกของเรื่องหนึ่ง ส่งออกเสมอ", async () => {
    const res = await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    expect(res.sent).toBe(true);
    expect(sendAdminAlert).toHaveBeenCalledOnce();
  });

  it("ข้อความเดิมในหน้าต่างเวลาเดิม ไม่ส่งซ้ำ แต่ยังนับไว้", async () => {
    // จำลองว่าเพิ่งส่งเนื้อเดียวกันไปเมื่อ 10 นาทีก่อน
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(TEXT).digest("hex").slice(0, 32);
    findUnique.mockResolvedValue({
      hash,
      lastSentAt: new Date(Date.now() - 10 * 60_000),
      suppressed: 3,
    });

    const res = await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    expect(res.sent).toBe(false);
    expect(res.suppressed).toBe(4);
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });

  it("เนื้อความเปลี่ยน = เรื่องเปลี่ยน ต้องเด้งทันทีไม่ต้องรอหมดเวลา", async () => {
    findUnique.mockResolvedValue({
      hash: "ของเดิมคนละเนื้อ",
      lastSentAt: new Date(Date.now() - 60_000),
      suppressed: 9,
    });

    const res = await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    expect(res.sent).toBe(true);
    // เรื่องคนละเรื่องกัน ห้ามไปแปะยอดที่กลั้นไว้ของเรื่องเก่า
    expect(sentText()).not.toContain("เกิดซ้ำอีก");
  });

  it("พ้นหน้าต่างเวลาแล้วส่งซ้ำได้ พร้อมบอกว่ากลั้นไปกี่ครั้ง", async () => {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(TEXT).digest("hex").slice(0, 32);
    findUnique.mockResolvedValue({
      hash,
      lastSentAt: new Date(Date.now() - 7 * 60 * 60_000),
      suppressed: 12,
    });

    const res = await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    expect(res.sent).toBe(true);
    // ยอดที่กลั้นไว้คือสัญญาณว่ามีอะไรวนอยู่ สำคัญกว่าตัวข้อความเอง ห้ามตกหล่น
    expect(sentText()).toContain("เกิดซ้ำอีก 12 ครั้ง");
  });

  it("คนละเรื่อง (คนละคีย์) ไม่กันกันเอง", async () => {
    await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    await sendAdminAlertThrottled("tv-grant-fail:g2", TEXT);
    expect(sendAdminAlert).toHaveBeenCalledTimes(2);
  });

  it("ส่งไม่ออก ต้องไม่จดว่าส่งแล้ว ไม่งั้นเรื่องนั้นจะเงียบไปทั้งหน้าต่างเวลา", async () => {
    sendAdminAlert.mockResolvedValue({ sent: false, reason: "Telegram ล่ม" });
    const res = await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    expect(res.sent).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ตารางกันซ้ำอ่านไม่ได้ ต้องยอมส่งออกไป ดีกว่าเงียบ", async () => {
    findUnique.mockRejectedValue(new Error("ยังไม่ได้ migrate"));
    const res = await sendAdminAlertThrottled("tv-grant-fail:g1", TEXT);
    expect(res.sent).toBe(true);
    expect(sendAdminAlert).toHaveBeenCalledOnce();
  });
});
