import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { upsertSubscription, recordPayment, ensureAccessGrant, ensureDiscordRole } from "@/lib/fulfillment";
import { syncTradingViewGrant, ensureTelegramInvite } from "@/lib/lifecycle";

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: "stripe disabled" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.userId;
      const planCode = s.metadata?.planCode;
      const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
      if (userId && subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertSubscription(userId, planCode, sub);
        if (s.amount_total) await recordPayment(userId, Math.round(s.amount_total / 100), s.id);
        await ensureAccessGrant(userId);
        await ensureTelegramInvite(userId);
        // ทางสลิปทำสองอย่างนี้ให้อยู่แล้ว ทาง Stripe ต้องได้เหมือนกันไม่งั้นสมาชิกได้ของไม่ครบ
        if (planCode) await ensureDiscordRole(userId, planCode);
        await syncTradingViewGrant(userId);
      }
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.billing_reason === "subscription_create") break;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (customerId && inv.amount_paid) {
        const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
        if (user) await recordPayment(user.id, Math.round(inv.amount_paid / 100), inv.id ?? `inv_${inv.created}`);
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) await upsertSubscription(userId, sub.metadata?.planCode, sub);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
