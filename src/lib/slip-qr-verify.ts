/**
 * ตรวจว่า QR ในสลิป "เป็นของธนาคารจริง" ไหม โดยไม่ต้องพึ่งบริการภายนอก
 *
 * QR ในสลิปโอนของไทยใช้โครงแบบ EMVCo (tag 2 หลัก + ความยาว 2 หลัก + ค่า)
 * และปิดท้ายด้วยช่อง `91` ที่เก็บ CRC16-CCITT ของทุกอย่างก่อนหน้า
 * ธนาคารเป็นคนคำนวณค่านี้ตอนออกสลิป ถ้าใครพิมพ์เลขมั่วหรือแก้ payload
 * checksum จะไม่ตรงทันที
 *
 * ⚠️ สิ่งที่ตรวจนี้ "ไม่ได้" พิสูจน์ — ว่าเงินเข้าบัญชีเราจริง
 * QR เก็บแค่เลขอ้างอิงรายการ ไม่ได้เก็บยอดและไม่ได้เก็บบัญชีปลายทาง
 * และตัว QR เป็นภาพ การแก้ "ตัวเลขยอดที่พิมพ์อยู่ข้าง ๆ" ด้วยแอปแต่งรูป
 * ไม่ทำให้ QR เปลี่ยน ดังนั้น checksum ตรง = สลิปนี้มาจากรายการโอนจริงรายการหนึ่ง
 * แต่ยอดกับปลายทางที่เห็นบนภาพยังเชื่อไม่ได้ 100% จนกว่าจะถามธนาคาร (EasySlip)
 *
 * ถึงอย่างนั้นก็ยังมีค่ามาก เพราะกันเคสที่ง่ายที่สุดได้: สลิปที่สร้างขึ้นเองทั้งใบ
 * หรือแคปจากเว็บทำสลิปปลอม จะไม่มี QR หรือมี QR ที่ checksum ไม่ผ่าน
 */

/** ช่องที่เก็บ checksum ในสลิปโอนของไทย (EMVCo ของ PromptPay ใช้ 63 แต่สลิปใช้ 91) */
const CRC_TAG = "9104";

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — ตัวเดียวกับที่ EMVCo กำหนด */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type QrIntegrity =
  | "valid"    // มี checksum และตรง
  | "invalid"  // มี checksum แต่ไม่ตรง — น่าสงสัยมาก
  | "absent";  // ไม่มีช่อง checksum (บางธนาคารไม่ใส่) — ตัดสินไม่ได้

export interface QrIntegrityResult {
  integrity: QrIntegrity;
  expected?: string;
  actual?: string;
}

/**
 * ตรวจ checksum ของ payload ที่อ่านมาจาก QR
 *
 * "absent" ไม่ใช่ความผิดปกติเสมอไป — สลิปบางธนาคารไม่มี QR หรือใส่คนละรูปแบบ
 * จึงต้องแยกจาก "invalid" ให้ชัด ไม่งั้นจะไปปฏิเสธลูกค้าที่ใช้ธนาคารที่เราไม่รู้จัก
 */
export function checkQrIntegrity(payload: string | undefined | null): QrIntegrityResult {
  if (!payload) return { integrity: "absent" };

  const at = payload.lastIndexOf(CRC_TAG);
  // checksum ต้องอยู่ท้ายสุดพอดี (tag 4 ตัว + ค่า 4 ตัว)
  if (at < 0 || at + 8 !== payload.length) return { integrity: "absent" };

  const actual = payload.slice(at + 4);
  if (!/^[0-9A-Fa-f]{4}$/.test(actual)) return { integrity: "absent" };

  const expected = crc16ccitt(payload.slice(0, at + 4));
  return {
    integrity: expected.toUpperCase() === actual.toUpperCase() ? "valid" : "invalid",
    expected,
    actual: actual.toUpperCase(),
  };
}
