import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/subscription";
import { plans } from "@/config/plans";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ถามว่าอีเมลนี้ยังมีสิทธิ์ใช้งานอยู่ไหม — สำหรับระบบพาร์ตเนอร์
 *
 * ทำไมต้องมี: QVX AI (ฝั่ง Supabase) มีตาราง ai_entitlements ของตัวเองไว้ตัดสิน
 * ว่าใครใช้ AI ได้ ซึ่งแยกจากวงจรชีวิตสมาชิกที่นี่ พอแยกกันแล้วมันไม่มีทางรู้เลย
 * ว่าใครหมดอายุ (ฝั่งโน้นไม่มีงานตามเวลาที่ปิดสิทธิ์) สิทธิ์เลยไม่มีวันหมด
 *
 * ทางแก้คือไม่ให้ที่โน่นตัดสินเอง ให้มาถามที่นี่ซึ่งเป็นที่เดียวที่รู้ความจริง
 * เพราะที่นี่มีทั้งการต่ออายุ การหมดอายุ และ cron ที่ปิดสิทธิ์ให้จริง
 *
 * ตั้งใจให้ตอบเฉพาะข้อเท็จจริงเรื่องสิทธิ์ ไม่คืนชื่อ เบอร์ หรือข้อมูลการจ่ายเงิน
 */

const schema = z.object({
  email: z.string().email().max(200),
});

/** เทียบ secret แบบไม่รั่วเวลา (กันการเดาทีละตัวอักษรจากเวลาตอบกลับ) */
function secretMatches(given: string): boolean {
  const expected = process.env.PARTNER_API_SECRET;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** อ่าน secret จาก header — ไม่รับทาง query string เพราะ URL ติดอยู่ใน log ของทุกชั้น */
function bearerFrom(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(req: Request) {
  // ไม่ได้ตั้ง secret = ปิดตาย ไม่ใช่เปิดโล่ง
  if (!process.env.PARTNER_API_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // เดา secret ซ้ำ ๆ ต้องถูกเบรก ถึงจะเดาได้ยากอยู่แล้วก็ตาม
  const ip = await getClientIp();
  const rlKey = `entitlement:${ip}`;
  if (await isRateLimited(rlKey, 20, 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  if (!secretMatches(bearerFrom(req))) {
    await recordAttempt(rlKey, 60_000);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  /**
   * ไม่มีบัญชีนี้ ตอบรูปแบบเดียวกับคนที่หมดอายุ
   * ถ้าตอบ 404 แยกไว้ ใครถือ secret จะใช้ไล่เช็คได้ว่าอีเมลไหนเป็นลูกค้าเรา
   */
  if (!user) {
    return NextResponse.json({ active: false, until: null, daysLeft: null, plan: null });
  }

  const { sub, isActive, daysLeft } = await getUserSubscription(user.id);
  const plan = sub ? plans.find((p) => p.id === sub.planCode) : undefined;

  return NextResponse.json({
    active: isActive,
    until: isActive ? (sub?.currentPeriodEnd?.toISOString() ?? null) : null,
    daysLeft: isActive ? daysLeft : null,
    plan: isActive ? (plan ? { code: plan.id, name: plan.name } : null) : null,
  });
}
