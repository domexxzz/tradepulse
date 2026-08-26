import { describe, it, expect, vi } from "vitest";

// subscription.ts import prisma มาตอนโหลดไฟล์ — เทสต์นี้ไม่ต้องใช้ฐานข้อมูล จึง mock ทิ้ง
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { isSubscriptionActive } = await import("@/lib/subscription");

type Sub = Parameters<typeof isSubscriptionActive>[0];
const make = (over: Partial<NonNullable<Sub>> = {}): Sub =>
  ({ status: "ACTIVE", currentPeriodEnd: new Date("2026-12-31"), stripeSubscriptionId: null, ...over }) as Sub;

const now = new Date("2026-08-25T00:00:00Z");

/**
 * บั๊กที่เคยมีจริง: เช็คแค่ status ทำให้จ่ายเดือนเดียวใช้ได้ตลอดชีพ
 * เทสต์ชุดนี้มีไว้กันไม่ให้ย้อนกลับไปเป็นแบบนั้นอีก
 */
describe("isSubscriptionActive", () => {
  it("ACTIVE และยังไม่ถึงวันหมดอายุ = ใช้ได้", () => {
    expect(isSubscriptionActive(make(), now)).toBe(true);
  });

  it("ACTIVE แต่เลยวันหมดอายุแล้ว = ใช้ไม่ได้ (หัวใจของบั๊กเดิม)", () => {
    expect(isSubscriptionActive(make({ currentPeriodEnd: new Date("2026-08-01") }), now)).toBe(false);
  });

  it("สถานะที่ปิดแล้วใช้ไม่ได้ แม้วันหมดอายุยังไม่ถึง", () => {
    for (const status of ["EXPIRED", "CANCELED", "PAST_DUE", "INACTIVE"]) {
      expect(isSubscriptionActive(make({ status }), now)).toBe(false);
    }
  });

  it("TRIALING ถือว่าใช้ได้", () => {
    expect(isSubscriptionActive(make({ status: "TRIALING" }), now)).toBe(true);
  });

  it("ไม่มีแพ็กเกจเลย = ใช้ไม่ได้", () => {
    expect(isSubscriptionActive(null, now)).toBe(false);
  });

  it("ไม่มีวันหมดอายุ + ไม่ใช่ของ Stripe = ไม่ให้สิทธิ์ (ข้อมูลไม่ครบ)", () => {
    expect(isSubscriptionActive(make({ currentPeriodEnd: null }), now)).toBe(false);
  });

  it("ไม่มีวันหมดอายุ แต่เป็นของ Stripe = เชื่อสถานะได้ (Stripe คุมรอบบิลเอง)", () => {
    expect(
      isSubscriptionActive(make({ currentPeriodEnd: null, stripeSubscriptionId: "sub_123" }), now)
    ).toBe(true);
  });

  it("หมดอายุพอดีวินาทีนี้ = ใช้ไม่ได้แล้ว", () => {
    expect(isSubscriptionActive(make({ currentPeriodEnd: now }), now)).toBe(false);
  });
});
