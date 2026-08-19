import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า Stripe" }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "ไม่พบข้อมูลลูกค้าใน Stripe" }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${base}/account/subscription`,
  });
  return NextResponse.json({ url: portal.url });
}
