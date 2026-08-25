/** อ่าน/ตรวจไฟล์สลิปที่สมาชิกอัปโหลดมาเป็น data URL */
import { createHash } from "crypto";

/** เพดานขนาดไฟล์จริง (ก่อนเข้ารหัส base64) */
export const MAX_SLIP_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface ParsedSlip {
  mime: string;
  base64: string;
  bytes: number;
  /** sha256 ของไฟล์ ใช้กันแนบสลิปรูปเดิมซ้ำ */
  hash: string;
}

export type ParseSlipResult = { ok: true; slip: ParsedSlip } | { ok: false; error: string };

/**
 * แปลง data URL เป็นข้อมูลที่ตรวจสอบแล้ว
 * ตรวจขนาดจากจำนวนไบต์จริง ไม่ใช่ความยาวสตริง base64 (ซึ่งใหญ่กว่าไฟล์จริง ~33%)
 */
export function parseSlipDataUrl(dataUrl: string): ParseSlipResult {
  const m = /^data:([a-z0-9/+.-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return { ok: false, error: "กรุณาแนบรูปสลิป (ไฟล์ภาพเท่านั้น)" };

  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return { ok: false, error: "รองรับเฉพาะไฟล์ภาพ JPG, PNG, WEBP หรือ HEIC" };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return { ok: false, error: "ไฟล์สลิปเสียหาย กรุณาลองใหม่" };
  }

  if (buf.byteLength === 0) return { ok: false, error: "ไฟล์สลิปว่างเปล่า" };
  if (buf.byteLength > MAX_SLIP_BYTES) {
    return { ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 3MB)" };
  }

  return {
    ok: true,
    slip: {
      mime,
      base64: m[2],
      bytes: buf.byteLength,
      hash: createHash("sha256").update(buf).digest("hex"),
    },
  };
}
