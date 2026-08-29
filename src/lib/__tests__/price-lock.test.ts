import { describe, expect, it } from "vitest";
import { PRICE_LOCK_GRACE_DAYS, isPriceLockValid } from "@/lib/pricing";

const NOW = new Date("2026-09-01T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

/** แพ็กเกจ QR ที่มีวันหมดอายุจริง — เคสหลักของระบบ (โหมด qr ไม่มี Stripe) */
const qr = (status: string, end: Date | null) => ({
  status,
  currentPeriodEnd: end,
  stripeSubscriptionId: null,
});

describe("isPriceLockValid", () => {
  it("ยังใช้งานอยู่ = ล็อกอยู่", () => {
    expect(isPriceLockValid(qr("ACTIVE", day(20)), NOW)).toBe(true);
  });

  it("หมดอายุแต่ยังอยู่ในช่วงผ่อนผัน = ล็อกอยู่", () => {
    expect(isPriceLockValid(qr("ACTIVE", day(-1)), NOW)).toBe(true);
    expect(isPriceLockValid(qr("ACTIVE", day(-(PRICE_LOCK_GRACE_DAYS - 1))), NOW)).toBe(true);
  });

  it("ขาดอายุเกินช่วงผ่อนผัน = เสียล็อก", () => {
    expect(isPriceLockValid(qr("ACTIVE", day(-(PRICE_LOCK_GRACE_DAYS + 1))), NOW)).toBe(false);
    expect(isPriceLockValid(qr("CANCELED", day(-30)), NOW)).toBe(false);
  });

  it("ขอบเขตพอดีวันสุดท้ายของผ่อนผัน ยังไม่เสียสิทธิ์", () => {
    const end = new Date(NOW.getTime() - PRICE_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000);
    expect(isPriceLockValid(qr("ACTIVE", end), NOW)).toBe(true);
    expect(isPriceLockValid(qr("ACTIVE", new Date(end.getTime() - 1)), NOW)).toBe(false);
  });

  /**
   * เคสข้อมูลไม่ครบต้อง "ไม่ริบ" เสมอ
   * เก็บเงินเกินเพราะข้อมูลขาด เสียหายกว่าเก็บน้อยไป — ดูเหตุผลเต็มใน pricing.ts
   */
  it("ไม่มีแพ็กเกจในระบบเลย = ไม่ริบ", () => {
    expect(isPriceLockValid(null, NOW)).toBe(true);
  });

  it("ไม่มีวันหมดอายุให้เทียบ = ไม่ริบ", () => {
    expect(isPriceLockValid(qr("CANCELED", null), NOW)).toBe(true);
  });

  it("แพ็กเกจ Stripe ที่ยังไม่ถูกยกเลิก แม้ไม่มี currentPeriodEnd ก็ถือว่าใช้งานอยู่", () => {
    expect(
      isPriceLockValid(
        { status: "ACTIVE", currentPeriodEnd: null, stripeSubscriptionId: "sub_1" },
        NOW
      )
    ).toBe(true);
  });
});
