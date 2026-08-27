import { describe, it, expect } from "vitest";
import {
  accountRefMatches,
  receiverMatches,
  isSlipFresh,
  parseSlipDate,
  normalizeAccountRef,
} from "@/lib/slip-receiver";

/** เลข PromptPay สมมติที่ใช้ทดสอบ (ไม่ใช่ของจริง) */
const MERCHANT = "0812345678";

describe("เทียบบัญชีผู้รับจากสลิปที่ถูกปิดบังเลข", () => {
  it("ตัดสัญลักษณ์ทิ้ง เหลือแต่ตัวเลขกับตัวปิดบัง", () => {
    expect(normalizeAccountRef("xxx-xxx-5678")).toBe("xxxxxx5678");
    // XXX + X + X = x ห้าตัว แล้วตามด้วย 1234 และ x ปิดท้าย
    expect(normalizeAccountRef("XXX-X-X1234-X")).toBe("xxxxx1234x");
  });

  it("ผ่านเมื่อเลขท้ายที่เห็นตรงกัน", () => {
    expect(accountRefMatches(MERCHANT, "xxx-xxx-5678")).toBe(true);
    expect(accountRefMatches(MERCHANT, "0812345678")).toBe(true);
  });

  it("ไม่ผ่านเมื่อเลขท้ายเป็นของบัญชีอื่น", () => {
    expect(accountRefMatches(MERCHANT, "xxx-xxx-9999")).toBe(false);
    expect(accountRefMatches(MERCHANT, "0899999999")).toBe(false);
  });

  // ด่านสำคัญ: ถ้าปล่อยผ่าน สลิปที่ปิดบังทั้งหมดจะกลายเป็นบัตรผ่านฟรี
  it("ไม่ผ่านเมื่อสลิปปิดบังจนไม่เหลือเลขให้เทียบ", () => {
    expect(accountRefMatches(MERCHANT, "xxx-xxx-xxxx")).toBe(false);
    expect(accountRefMatches(MERCHANT, "xxxx")).toBe(false);
  });

  it("ไม่ผ่านเมื่อเห็นเลขจริงน้อยกว่า 4 ตัว", () => {
    expect(accountRefMatches(MERCHANT, "xxx-xxx-xx78")).toBe(false);
    expect(accountRefMatches(MERCHANT, "xxx-xxx-x678")).toBe(false);
  });

  it("ไม่ผ่านเมื่อยังไม่ได้ตั้งเลขบัญชีไว้", () => {
    expect(accountRefMatches("", "xxx-xxx-5678")).toBe(false);
    expect(receiverMatches("", ["xxx-xxx-5678"])).toBe(false);
  });

  it("ผ่านถ้าตรงช่องใดช่องหนึ่ง (PromptPay หรือเลขบัญชี)", () => {
    expect(receiverMatches(MERCHANT, [undefined, "xxx-xxx-5678"])).toBe(true);
    expect(receiverMatches(MERCHANT, ["xxx-xxx-5678", "xxx-x-x0000-x"])).toBe(true);
    expect(receiverMatches(MERCHANT, [undefined, null])).toBe(false);
  });
});

describe("ความสดของสลิป", () => {
  const order = new Date("2026-08-28T10:00:00+07:00");
  const now = new Date("2026-08-28T10:20:00+07:00");

  it("ผ่านเมื่อโอนหลังสร้างออเดอร์", () => {
    expect(isSlipFresh(new Date("2026-08-28T10:05:00+07:00"), order, now)).toBe(true);
  });

  it("ผ่านเมื่อโอนก่อนหน้าเล็กน้อย (เผื่อนาฬิกาคลาด)", () => {
    expect(isSlipFresh(new Date("2026-08-28T09:45:00+07:00"), order, now)).toBe(true);
  });

  // นี่คือกรณีที่ด่านนี้มีไว้กัน — สลิปเก่ายอดเท่ากันที่ขุดมาใช้ซ้ำ
  it("ไม่ผ่านเมื่อเป็นสลิปเก่าคนละวัน", () => {
    expect(isSlipFresh(new Date("2026-08-01T10:00:00+07:00"), order, now)).toBe(false);
  });

  it("ไม่ผ่านเมื่อวันที่ล้ำอนาคตเกินเผื่อ", () => {
    expect(isSlipFresh(new Date("2026-08-28T12:00:00+07:00"), order, now)).toBe(false);
  });

  it("อ่านวันที่ไม่ออกให้คืน null ไม่ใช่ throw", () => {
    expect(parseSlipDate(undefined)).toBeNull();
    expect(parseSlipDate("")).toBeNull();
    expect(parseSlipDate("ไม่ใช่วันที่")).toBeNull();
    expect(parseSlipDate("2026-08-28T13:45:00+07:00")).toBeInstanceOf(Date);
  });
});
