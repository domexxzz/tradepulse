import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, mapStatus } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

async function upsertSubscription(
  userId: string,
  planCode: string | undefined,
  sub: Stripe.Subscription
) {
  const status = mapStatus(sub.status);
  // Stripe API ใหม่: current_period_end อยู่ที่ระดับ subscription item
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        planCode: planCode ?? existing.planCode,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        planCode: planCode ?? "MONTH",
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
  }
}

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
        if (s.amount_total) {
          await prisma.payment.create({
            data: {
              userId,
              amountTHB: Math.round(s.amount_total / 100),
              provider: "stripe",
              providerRef: s.id,
              status: "paid",
            },
          });
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        await prisma.accessGrant.create({
          data: {
            userId,
            status: "PENDING",
            tradingViewUsername: user?.tradingViewUsername ?? null,
          },
        });
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
