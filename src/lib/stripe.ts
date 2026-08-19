import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/** null ถ้ายังไม่ตั้งค่า STRIPE_SECRET_KEY (ปุ่มชำระเงินจะแจ้งเตือนแทน) */
export const stripe = key ? new Stripe(key) : null;
export const stripeEnabled = !!key;

/** map planCode -> Stripe Price ID (จาก env) */
export function priceIdFor(planCode: string): string | undefined {
  const map: Record<string, string | undefined> = {
    MONTH: process.env.STRIPE_PRICE_MONTH,
    Q3: process.env.STRIPE_PRICE_Q3,
    H6: process.env.STRIPE_PRICE_H6,
    YEAR: process.env.STRIPE_PRICE_YEAR,
  };
  return map[planCode];
}

/** แปลงสถานะ Stripe -> สถานะภายในระบบ */
export function mapStatus(s: string): string {
  switch (s) {
    case "active": return "ACTIVE";
    case "trialing": return "TRIALING";
    case "past_due": return "PAST_DUE";
    case "canceled":
    case "unpaid": return "CANCELED";
    default: return "INACTIVE";
  }
}
