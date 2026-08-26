import { describe, it, expect } from "vitest";
import { parseSlipDataUrl, MAX_SLIP_BYTES } from "@/lib/slip";

// PNG 1x1 พิกเซลจริง ๆ ใช้เป็นไฟล์ตัวอย่าง
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const dataUrl = (mime: string, b64: string) => `data:${mime};base64,${b64}`;

/**
 * สลิปคือหลักฐานการจ่ายเงิน — ถ้า hash ไม่นิ่งหรือรับไฟล์มั่ว ๆ ได้
 * ระบบกันสลิปซ้ำจะพังทันที
 */
describe("parseSlipDataUrl", () => {
  it("รับไฟล์ภาพที่ถูกต้อง", () => {
    const r = parseSlipDataUrl(dataUrl("image/png", PNG_1PX));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slip.mime).toBe("image/png");
      expect(r.slip.bytes).toBeGreaterThan(0);
      expect(r.slip.hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("ไฟล์เดิมต้องได้ hash เดิมเสมอ (ไม่งั้นกันสลิปซ้ำไม่ได้)", () => {
    const a = parseSlipDataUrl(dataUrl("image/png", PNG_1PX));
    const b = parseSlipDataUrl(dataUrl("image/png", PNG_1PX));
    expect(a.ok && b.ok && a.slip.hash === b.slip.hash).toBe(true);
  });

  it("ไฟล์ต่างกันต้องได้ hash ต่างกัน", () => {
    const other = Buffer.from("ภาพอีกใบที่ไม่เหมือนเดิม").toString("base64");
    const a = parseSlipDataUrl(dataUrl("image/png", PNG_1PX));
    const b = parseSlipDataUrl(dataUrl("image/png", other));
    expect(a.ok && b.ok && a.slip.hash !== b.slip.hash).toBe(true);
  });

  it("ปฏิเสธไฟล์ที่ไม่ใช่ภาพ", () => {
    const r = parseSlipDataUrl(dataUrl("application/pdf", PNG_1PX));
    expect(r.ok).toBe(false);
  });

  it("ปฏิเสธข้อความที่ไม่ใช่ data URL", () => {
    expect(parseSlipDataUrl("https://example.com/slip.png").ok).toBe(false);
    expect(parseSlipDataUrl("").ok).toBe(false);
  });

  it("ปฏิเสธไฟล์ว่าง", () => {
    expect(parseSlipDataUrl(dataUrl("image/png", "")).ok).toBe(false);
  });

  it("ปฏิเสธไฟล์ที่ใหญ่เกินเพดาน", () => {
    const big = Buffer.alloc(MAX_SLIP_BYTES + 1024, 1).toString("base64");
    const r = parseSlipDataUrl(dataUrl("image/jpeg", big));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ใหญ่เกินไป");
  });

  it("วัดขนาดจากไบต์จริง ไม่ใช่ความยาว base64 (base64 ใหญ่กว่าไฟล์ ~33%)", () => {
    // ไฟล์ 2.5MB ยังผ่าน ทั้งที่สตริง base64 ยาวเกิน 3MB
    const bytes = 2.5 * 1024 * 1024;
    const b64 = Buffer.alloc(bytes, 7).toString("base64");
    expect(b64.length).toBeGreaterThan(MAX_SLIP_BYTES);
    expect(parseSlipDataUrl(dataUrl("image/jpeg", b64)).ok).toBe(true);
  });
});
