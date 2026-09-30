import { describe, it, expect } from "vitest";
import { isRetryableSlipError } from "@/lib/slip-verify";

/**
 * แยก "ยังตอบไม่ได้ตอนนี้" ออกจาก "สลิปใช้ไม่ได้"
 *
 * ตีตกผิดเป็น FAILED = แอดมินต้องไปตรวจมือทั้งที่รออีก 5 นาทีระบบก็ตอบได้เอง
 * ตีเป็น RETRY ผิด = สลิปปลอมถูกตรวจซ้ำไปเรื่อย ๆ แทนที่จะถูกตีตกทันที
 * เทสต์นี้ล็อกเส้นแบ่งไว้ทั้งสองทาง
 */
describe("isRetryableSlipError", () => {
  it("slip_pending ของธนาคารกรุงเทพ = รอแล้วลองใหม่", () => {
    expect(isRetryableSlipError("slip_pending")).toBe(true);
  });

  it("โดนจำกัดอัตรา = ลองใหม่", () => {
    expect(isRetryableSlipError("rate_limit_exceeded")).toBe(true);
    expect(isRetryableSlipError(undefined, 429)).toBe(true);
  });

  it("ฝั่งผู้ให้บริการพัง = ลองใหม่", () => {
    expect(isRetryableSlipError(undefined, 500)).toBe(true);
    expect(isRetryableSlipError(undefined, 503)).toBe(true);
  });

  it("หมดเวลา/เน็ตสะดุด = ลองใหม่ ไม่ใช่ความผิดของสลิป", () => {
    expect(isRetryableSlipError("The operation was aborted due to timeout")).toBe(true);
    expect(isRetryableSlipError("fetch failed")).toBe(true);
    expect(isRetryableSlipError("ETIMEDOUT")).toBe(true);
  });

  it("สลิปมีปัญหาจริง = ห้ามลองใหม่ ต้องตีตกเลย", () => {
    expect(isRetryableSlipError("duplicate_slip")).toBe(false);
    expect(isRetryableSlipError("slip_not_found")).toBe(false);
    expect(isRetryableSlipError("slip_expired")).toBe(false);
    expect(isRetryableSlipError("qrcode_not_found")).toBe(false);
    expect(isRetryableSlipError("invalid_image")).toBe(false);
  });

  it("โควต้าหมดกับรหัสผิด = ต้องมีคนไปแก้ ลองใหม่เองไม่ช่วย", () => {
    expect(isRetryableSlipError("quota_exceeded")).toBe(false);
    expect(isRetryableSlipError("unauthorized")).toBe(false);
    expect(isRetryableSlipError(undefined, 401)).toBe(false);
  });

  it("ไม่มีข้อความและไม่มีรหัส = ไม่เดาว่าลองใหม่ได้", () => {
    expect(isRetryableSlipError(undefined)).toBe(false);
  });
});
