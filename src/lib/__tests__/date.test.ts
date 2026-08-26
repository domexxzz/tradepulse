import { describe, it, expect } from "vitest";
import { addMonths, daysUntil } from "@/lib/date";

/**
 * addMonths คือหัวใจของการคิดวันหมดอายุ — คิดผิดหนึ่งวันคือลูกค้าได้/เสียสิทธิ์ผิด
 * เคสที่พังง่ายที่สุดคือสิ้นเดือน เพราะ JS เลื่อนไปเดือนถัดไปให้เองแบบเงียบ ๆ
 */
describe("addMonths", () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const at = (s: string) => new Date(`${s}T12:00:00Z`);

  it("31 ม.ค. + 1 เดือน ต้องได้ 28 ก.พ. ไม่ใช่ 3 มี.ค.", () => {
    expect(iso(addMonths(at("2026-01-31"), 1))).toBe("2026-02-28");
  });

  it("ปีอธิกสุรทินต้องได้ 29 ก.พ.", () => {
    expect(iso(addMonths(at("2024-01-31"), 1))).toBe("2024-02-29");
  });

  it("31 ส.ค. + 3 เดือน ต้องได้ 30 พ.ย. (เดือนมี 30 วัน)", () => {
    expect(iso(addMonths(at("2026-08-31"), 3))).toBe("2026-11-30");
  });

  it("ข้ามปีได้ถูกต้อง", () => {
    expect(iso(addMonths(at("2026-12-15"), 1))).toBe("2027-01-15");
    expect(iso(addMonths(at("2026-01-15"), 12))).toBe("2027-01-15");
  });

  it("วันกลางเดือนไม่ถูกขยับ", () => {
    expect(iso(addMonths(at("2026-08-25"), 6))).toBe("2027-02-25");
  });

  it("ไม่แก้ค่า Date ตัวเดิมที่ส่งเข้ามา", () => {
    const original = at("2026-01-31");
    const copy = new Date(original.getTime());
    addMonths(original, 5);
    expect(original.getTime()).toBe(copy.getTime());
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-08-25T00:00:00Z");

  it("นับวันข้างหน้าได้ถูก", () => {
    expect(daysUntil(new Date("2026-08-28T00:00:00Z"), now)).toBe(3);
  });

  it("วันที่ผ่านมาแล้วต้องติดลบ", () => {
    expect(daysUntil(new Date("2026-08-20T00:00:00Z"), now)).toBe(-5);
  });

  it("วันเดียวกันคือ 0", () => {
    expect(daysUntil(now, now)).toBe(0);
  });
});
