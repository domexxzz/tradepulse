import { stripe } from "@/lib/stripe";
import { upsertSubscription, recordPayment, ensureAccessGrant, ensureTelegramGrant } from "@/lib/fulfillment";

/**
 * ซิงก์สถานะจาก Stripe Checkout Session (เรียกบนหน้า success)
 * ทำงานเป็น safety-net เมื่อ webhook ยังไม่ถึง (เช่น dev ที่ไม่มี Stripe CLI)
 * ยืนยันว่า session เป็นของ user คนนี้จริงก่อนทำงาน
 */
export async function syncCheckoutSession(sessionId: string, userId: string): Promise<boolean> {
  if (!stripe) return false;
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    if (s.metadata?.userId !== userId) return false;
    if (s.payment_status !== "paid" && s.status !== "complete") return false;

    const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
    if (!subId) return false;

    const sub = await stripe.subscriptions.retrieve(subId);
    await upsertSubscription(userId, s.metadata?.planCode, sub);
    if (s.amount_total) await recordPayment(userId, Math.round(s.amount_total / 100), s.id);
    await ensureAccessGrant(userId);
    await ensureTelegramGrant(userId);
    return true;
  } catch {
    return false;
  }
}
