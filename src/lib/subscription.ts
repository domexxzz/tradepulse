import { prisma } from "@/lib/prisma";
import { daysUntil } from "@/lib/date";
import type { Subscription } from "@prisma/client";

/** สถานะที่ "ยังจ่ายเงินอยู่" — ต้องผ่านการเช็ควันหมดอายุอีกชั้นก่อนถือว่าใช้งานได้ */
export const ACTIVE_STATUSES = ["ACTIVE", "TRIALING"];

/**
 * แพ็กเกจนี้ยังใช้งานได้จริงไหม
 *
 * เช็คสองชั้นเสมอ: สถานะ + วันหมดอายุ
 * เพราะโหมด QR ไม่มี webhook มาปิดสถานะให้เหมือน Stripe ถ้าดูแค่ status
 * สมาชิกที่จ่ายเดือนเดียวจะใช้งานได้ตลอดชีพ (เคยเป็นบั๊กจริงมาก่อน)
 *
 * currentPeriodEnd เป็น null: เชื่อสถานะได้เฉพาะแพ็กเกจที่ Stripe คุมรอบบิลเอง
 * ส่วนแพ็กเกจ QR ที่ไม่มีวันหมดอายุถือว่าใช้ไม่ได้ (ข้อมูลไม่ครบ = ไม่ให้สิทธิ์)
 */
export function isSubscriptionActive(
  sub: Pick<Subscription, "status" | "currentPeriodEnd" | "stripeSubscriptionId"> | null,
  now: Date = new Date()
): boolean {
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) return false;
  if (!sub.currentPeriodEnd) return Boolean(sub.stripeSubscriptionId);
  return sub.currentPeriodEnd.getTime() > now.getTime();
}

export interface UserSubscription {
  sub: Subscription | null;
  isActive: boolean;
  /** เหลืออีกกี่วัน (null เมื่อไม่มีวันหมดอายุ หรือไม่มีแพ็กเกจ) */
  daysLeft: number | null;
  /** ใกล้หมดอายุใน 7 วัน — ใช้ขึ้นแบนเนอร์เตือนต่ออายุ */
  expiringSoon: boolean;
}

/**
 * ดึงแพ็กเกจที่ใช้ตัดสินสิทธิ์ของผู้ใช้ พร้อมสรุปว่าใช้งานได้อยู่ไหมและเหลือกี่วัน
 *
 * เอา "แถวที่ยังใช้งานได้และหมดอายุไกลที่สุด" ก่อนเสมอ ค่อยตกมาที่แถวล่าสุด
 *
 * ของเดิมเอาแถวล่าสุดตาม createdAt อย่างเดียว ซึ่งถูกเฉพาะตอนที่ผู้ใช้มีแถวเดียว
 * คนที่ปล่อยให้หลุดแล้วค่อยต่ออายุจะมีสองแถว (ของเดิมที่หมดแล้ว + ของใหม่)
 * พอแถวไหนก็ตามที่ไม่ใช่ของใหม่กลายเป็นแถวล่าสุด — เช่นแอดมินแถมวันให้ทีหลัง
 * บนแถวเก่า — ระบบจะตอบว่า "หมดอายุแล้ว" ทั้งที่ลูกค้าจ่ายเงินอยู่
 * เลือกจากของจริงที่ยังใช้ได้ ปลอดภัยกว่าเลือกจากลำดับเวลาที่สร้างแถว
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const live = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ACTIVE_STATUSES },
      currentPeriodEnd: { gt: new Date() },
    },
    orderBy: { currentPeriodEnd: "desc" },
  });

  const sub =
    live ??
    (await prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }));

  const isActive = isSubscriptionActive(sub);
  const daysLeft = sub?.currentPeriodEnd ? daysUntil(sub.currentPeriodEnd) : null;

  return {
    sub,
    isActive,
    daysLeft,
    expiringSoon: isActive && daysLeft !== null && daysLeft <= 7,
  };
}

/** เช็คสิทธิ์แบบเร็วสำหรับจุดที่ต้องการแค่ true/false */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { isActive } = await getUserSubscription(userId);
  return isActive;
}
