import { z } from "zod";

/**
 * Payload ที่อินดิเคเตอร์ TradePulse ยิงออกมา (ดู ALERTS section ใน Pine source)
 * ตัวอย่าง: {"secret":"...","symbol":"XAUUSD","side":"BUY","price":4603.14,
 *            "tf":"30","sl":4590.1,"tp1":4620.5,"tp2":4640.2}
 */
export const signalPayloadSchema = z.object({
  secret: z.string().min(1).max(200),
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9._:-]+$/, "symbol มีอักขระที่ไม่อนุญาต"),
  side: z.enum(["BUY", "SELL"]),
  price: z.number().finite().positive(),
  tf: z.string().min(1).max(10).regex(/^[A-Za-z0-9]+$/, "tf มีอักขระที่ไม่อนุญาต"),
  sl: z.number().finite().positive().optional(),
  tp1: z.number().finite().positive().optional(),
  tp2: z.number().finite().positive().optional(),
});

export type SignalPayload = z.infer<typeof signalPayloadSchema>;

/** ขนาด body สูงสุดที่ยอมรับ — payload จริงราว 150 bytes */
export const MAX_SIGNAL_BODY_BYTES = 2_048;

/**
 * เทียบ secret แบบ constant-time กัน timing attack
 * (ไม่ใช้ crypto.timingSafeEqual เพราะ length ต่างกันจะ throw ซึ่งเองก็รั่วข้อมูล)
 */
export function isSecretValid(received: string, expected: string): boolean {
  if (expected.length === 0) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** ตรวจความสมเหตุสมผลของแผนเทรด — กันข้อมูลเพี้ยนเข้า DB */
export function isPlanCoherent(p: SignalPayload): boolean {
  const { side, price, sl, tp1, tp2 } = p;
  if (side === "BUY") {
    if (sl !== undefined && sl >= price) return false;
    if (tp1 !== undefined && tp1 <= price) return false;
    if (tp2 !== undefined && tp1 !== undefined && tp2 <= tp1) return false;
  } else {
    if (sl !== undefined && sl <= price) return false;
    if (tp1 !== undefined && tp1 >= price) return false;
    if (tp2 !== undefined && tp1 !== undefined && tp2 >= tp1) return false;
  }
  return true;
}
