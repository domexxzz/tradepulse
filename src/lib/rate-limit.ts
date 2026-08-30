import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * จำกัดจำนวนครั้ง (rate limit) แบบเก็บสถานะใน DB
 *
 * ทำไมต้องเก็บใน DB ไม่ใช่ในหน่วยความจำ: Vercel รันแบบ serverless
 * แต่ละ request อาจตกไปคนละ instance ตัวนับในหน่วยความจำจึงไม่แชร์กัน
 * — ยิง 100 ครั้งกระจายไป 100 instance ตัวนับในเครื่องนับได้แค่ 1 ทุกเครื่อง
 * ที่เก็บกลางเท่านั้นที่นับรวมได้จริง
 *
 * ออกแบบให้ "พังแล้วไม่ล็อกทั้งระบบ": ถ้าอ่าน DB ไม่ได้ ให้ถือว่ายังไม่เกินลิมิต
 * (fail-open) เพราะการทำให้ทุกคนล็อกอินไม่ได้เพราะตัวนับพัง แย่กว่าการปล่อย
 * ให้เดารหัสได้ชั่วคราว
 */

/** ดึง IP ของผู้เรียกจาก header ที่ Vercel/proxy แนบมา */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    // x-forwarded-for อาจมีหลาย IP คั่นด้วยจุลภาค ตัวแรกคือผู้เรียกจริง
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    // เรียกนอก request scope (เช่นตอนเทส) — ไม่มี IP ให้ดู
    return "unknown";
  }
}

/** เกินลิมิตแล้วหรือยัง — true = ควรบล็อก */
export async function isRateLimited(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row) return false;
    // หมดช่วงเวลาแล้ว = เริ่มนับใหม่ ยังไม่เกิน
    if (Date.now() - row.windowStart.getTime() > windowMs) return false;
    return row.count >= max;
  } catch {
    return false; // fail-open — ดูคอมเมนต์หัวไฟล์
  }
}

/**
 * นับความพยายามหนึ่งครั้ง (เรียกเฉพาะครั้งที่ "ล้มเหลว" สำหรับ login
 * ไม่งั้นคนล็อกอินถูกก็จะถูกนับจนเต็มลิมิตเปล่า ๆ)
 */
export async function recordAttempt(key: string, windowMs: number): Promise<void> {
  try {
    const now = new Date();
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStart.getTime() > windowMs) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
    } else {
      await prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
  } catch {
    // best-effort — นับพลาดหนึ่งครั้งไม่เป็นไร
  }
}

/** ล้างตัวนับของ key นี้ — เรียกตอนล็อกอินสำเร็จ ไม่ให้ค้างจากที่พิมพ์ผิดก่อนหน้า */
export async function clearRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch {
    /* ignore */
  }
}

/**
 * ตัวช่วยรวบยอด: เช็กหลาย key พร้อมกัน (เช่น จำกัดทั้งต่อบัญชีและต่อ IP)
 * เกิน key ใด key หนึ่ง = บล็อก
 */
export async function anyRateLimited(
  checks: { key: string; max: number; windowMs: number }[]
): Promise<boolean> {
  const results = await Promise.all(
    checks.map((c) => isRateLimited(c.key, c.max, c.windowMs))
  );
  return results.some(Boolean);
}
