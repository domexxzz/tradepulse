import { describe, it, expect } from "vitest";
import { checkQrIntegrity, crc16ccitt } from "@/lib/slip-qr-verify";

/**
 * payload จริงจากสลิปลูกค้า 3 ใบ (29 ก.ย. 2569) — ไม่ใช่ค่าที่แต่งขึ้น
 * ถ้าการตรวจนี้พัง ระบบจะปฏิเสธสลิปจริงของลูกค้าทั้งหมด
 */
const REAL = [
  "0041000600000101030040220016272234025CTF039105102TH91041F78",
  "004600060000010103002022520260929232341230011310085102TH91041CE8",
  "0046000600000101030140225202609295mGjOyPl4kvf2wgvT5102TH91041A00",
];

describe("checksum ของ QR ในสลิป", () => {
  it("สลิปจริงจากธนาคารต้องผ่านทุกใบ", () => {
    for (const p of REAL) {
      expect(checkQrIntegrity(p).integrity, p.slice(-12)).toBe("valid");
    }
  });

  it("แก้ payload แม้ตัวเดียว ต้องจับได้", () => {
    const p = REAL[0];
    // เปลี่ยนเลขกลาง payload หนึ่งตัว
    const tampered = p.slice(0, 20) + (p[20] === "9" ? "8" : "9") + p.slice(21);
    expect(checkQrIntegrity(tampered).integrity).toBe("invalid");
  });

  it("checksum ที่แก้เองก็ต้องจับได้", () => {
    const p = REAL[1].slice(0, -4) + "0000";
    expect(checkQrIntegrity(p).integrity).toBe("invalid");
  });

  it("ไม่มีช่อง checksum ต้องเป็น absent ไม่ใช่ invalid", () => {
    // บางธนาคารไม่ใส่ — ปฏิเสธลูกค้าเพราะเหตุนี้ไม่ได้
    expect(checkQrIntegrity("00060000010103004022001627").integrity).toBe("absent");
    expect(checkQrIntegrity("").integrity).toBe("absent");
    expect(checkQrIntegrity(undefined).integrity).toBe("absent");
  });

  it("checksum ต้องอยู่ท้ายสุดเท่านั้น ไม่ใช่โผล่กลางข้อความ", () => {
    expect(checkQrIntegrity("9104ABCD0000").integrity).toBe("absent");
  });

  it("ค่า CRC ตรงตามมาตรฐาน EMVCo", () => {
    // ตัวอย่างอ้างอิงจากสเปก PromptPay
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});
