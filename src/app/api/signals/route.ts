import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEED_LIMIT = 8;

/**
 * ฟีดสัญญาณล่าสุด
 * - ผู้เยี่ยมชมทั่วไป: เห็นแค่ symbol / ทิศทาง / ไทม์เฟรม / เวลา (teaser)
 * - สมาชิกที่ subscription ยัง active: เห็น Entry / SL / TP1 / TP2 ครบ
 * แยกที่ฝั่ง server เท่านั้น — ห้ามส่งตัวเลขจริงออกไปแล้วค่อยซ่อนด้วย CSS
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  const { isActive } = userId
    ? await getUserSubscription(userId)
    : { isActive: false };

  const rows = await prisma.signal.findMany({
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
    select: {
      id: true,
      symbol: true,
      side: true,
      tf: true,
      createdAt: true,
      ...(isActive ? { price: true, sl: true, tp1: true, tp2: true } : {}),
    },
  });

  return NextResponse.json(
    { locked: !isActive, signals: rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}
