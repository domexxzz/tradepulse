import type { Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserSubscription, isSubscriptionActive } from "@/lib/subscription";
import {
  MONTHLY_PROMO,
  MONTHLY_REGULAR,
  PROMO_SEATS,
  plansFor,
  type Plan,
} from "@/config/plans";

export interface PromoState {
  seats: number;
  taken: number;
  remaining: number;
  active: boolean;
  monthlyTHB: number;
}

/**
 * นับสมาชิกที่จ่ายเงินจริงแล้ว — คนที่ได้สิทธิ์ฟรี (0 บาท) ไม่กินที่นั่งโปร
 * @param excludeUserId ไม่นับคนนี้ ใช้ตอนถามว่า "ก่อนหน้าคนนี้มีกี่คนแล้ว"
 */
export async function countPaidMembers(excludeUserId?: string): Promise<number> {
  const rows = await prisma.payment.findMany({
    where: {
      status: "paid",
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}

/**
 * สถานะโปรเปิดตัวตอนนี้
 * ถ้าต่อฐานข้อมูลไม่ได้ให้ถือว่าโปรหมดแล้ว — ปลอดภัยกว่าเผลอขายราคาโปรให้คนที่ 500
 */
export async function getPromoState(): Promise<PromoState> {
  try {
    const taken = await countPaidMembers();
    const remaining = Math.max(0, PROMO_SEATS - taken);
    const active = remaining > 0;
    return {
      seats: PROMO_SEATS,
      taken,
      remaining,
      active,
      monthlyTHB: active ? MONTHLY_PROMO : MONTHLY_REGULAR,
    };
  } catch {
    return {
      seats: PROMO_SEATS,
      taken: PROMO_SEATS,
      remaining: 0,
      active: false,
      monthlyTHB: MONTHLY_REGULAR,
    };
  }
}

/** ผ่อนผันหลังหมดอายุกี่วัน ก่อนถือว่า "ขาดอายุ" แล้วเสียสิทธิ์ราคาล็อก */
export const PRICE_LOCK_GRACE_DAYS = 7;

const GRACE_MS = PRICE_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000;

/**
 * ราคาที่ล็อกไว้ยังใช้ได้อยู่ไหม — ล็อกอยู่ได้ตราบที่ยังไม่ขาดอายุ
 *
 * แยกเป็นฟังก์ชันบริสุทธิ์เพื่อให้ทดสอบได้โดยไม่ต้องมี DB
 *
 * ⚠️ ทุกทางที่ "พิสูจน์ไม่ได้ว่าขาดอายุ" ให้ถือว่าล็อกยังอยู่ ไม่ใช่ริบทิ้ง
 * เก็บเงินเกินเพราะข้อมูลไม่ครบ เสียหายกว่าการเก็บน้อยไปมาก — ลูกค้าเสียเงินจริง
 * และเราผิดคำที่โฆษณาไว้ ส่วนเก็บน้อยไปแค่เสียรายได้ส่วนต่างชั่วคราว
 *
 * มีช่วงผ่อนผันเพราะถ้าไม่มี คนที่ต่ออายุช้าไปวันเดียวจะเสียส่วนลดถาวร
 * ซึ่งรุนแรงเกินไปสำหรับความผิดพลาดเล็กน้อย
 */
export function isPriceLockValid(
  sub: Pick<Subscription, "status" | "currentPeriodEnd" | "stripeSubscriptionId"> | null,
  now: Date = new Date()
): boolean {
  if (!sub) return true;
  if (isSubscriptionActive(sub, now)) return true;
  if (!sub.currentPeriodEnd) return true;
  return now.getTime() <= sub.currentPeriodEnd.getTime() + GRACE_MS;
}

/**
 * ราคารายเดือนที่ผู้ใช้คนนี้ต้องจ่ายจริง
 *
 * สมาชิกที่ถูกล็อกราคาไว้ (300 คนแรก) ได้ราคาเดิม "ตราบที่ต่ออายุต่อเนื่อง"
 * ขาดอายุเกินช่วงผ่อนผันแล้วกลับมาสมัครใหม่ จะได้ราคาปัจจุบันแทน
 *
 * ฟังก์ชันนี้อ่านอย่างเดียว ไม่ลบ lockedMonthlyTHB ทิ้ง — ถ้าลบ แล้วภายหลัง
 * พบว่าคำนวณผิด จะกู้กลับไม่ได้ว่าใครเคยได้ราคาล็อกบ้าง
 */
export async function monthlyPriceFor(userId: string): Promise<number> {
  const [user, { sub }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { lockedMonthlyTHB: true },
    }),
    getUserSubscription(userId),
  ]);

  if (user?.lockedMonthlyTHB && isPriceLockValid(sub)) return user.lockedMonthlyTHB;

  const promo = await getPromoState();
  return promo.monthlyTHB;
}

/** รายการแพ็กเกจพร้อมราคาที่ผู้ใช้คนนี้ต้องจ่ายจริง */
export async function plansForUser(userId: string): Promise<Plan[]> {
  return plansFor(await monthlyPriceFor(userId));
}

/**
 * ล็อกราคาโปรให้สมาชิกตอนจ่ายเงินครั้งแรก
 * ล็อกครั้งเดียว ไม่ทับของเดิม เพื่อไม่ให้ราคาที่เคยให้ไว้เปลี่ยนย้อนหลัง
 *
 * ต้องนับที่นั่งแบบ "ไม่รวมตัวเอง" เพราะฟังก์ชันนี้ถูกเรียกหลัง recordPayment แล้ว
 * ถ้านับรวมตัวเอง คนที่ 300 จะเห็น remaining = 0 แล้วหลุดการล็อก ทั้งที่เพิ่งจ่าย
 * ราคาโปรไป — พอต่ออายุรอบหน้าจะโดนเก็บ 1,290 สวนกับที่หน้าเว็บสัญญาไว้
 */
export async function lockPromoPriceIfEligible(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedMonthlyTHB: true },
  });
  if (user?.lockedMonthlyTHB) return;

  const takenBeforeThisUser = await countPaidMembers(userId);
  if (takenBeforeThisUser >= PROMO_SEATS) return;

  await prisma.user.update({
    where: { id: userId },
    data: { lockedMonthlyTHB: MONTHLY_PROMO },
  });
}
