import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, priceIdFor } from "@/lib/stripe";
import { salesPaused } from "@/config/site";

export async function POST(req: Request) {
  // ทางที่สองที่เก็บเงินได้ — ต้องปิดพร้อมกับ QR ไม่งั้นปิดไม่จริง
  if (salesPaused) {
    return NextResponse.json(
      { error: "หยุดรับชำระเงินชั่วคราว — ติดต่อทีมงานได้ตามช่องทางในหน้าเว็บ" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่าระบบชำระเงิน (Stripe) — ติดต่อผ่าน LINE OA เพื่อสมัคร" },
      { status: 503 }
    );
  }

  const { planCode } = (await req.json()) as { planCode?: string };
  const priceId = planCode ? priceIdFor(planCode) : undefined;
  if (!priceId) {
    return NextResponse.json({ error: "ไม่พบราคาแพ็คเกจนี้ใน Stripe" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  let customerId = user?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#pricing`,
    allow_promotion_codes: true,
    metadata: { userId: session.user.id, planCode: planCode! },
    subscription_data: { metadata: { userId: session.user.id, planCode: planCode! } },
  });

  return NextResponse.json({ url: checkout.url });
}
