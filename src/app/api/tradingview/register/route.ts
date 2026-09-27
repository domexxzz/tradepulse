import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeBridgeUrl } from "@/lib/tradingview";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * บอท TradingView รายงาน URL ของตัวเองเข้ามา — botkeeper เรียกเมื่อ tunnel ได้ URL ใหม่ และทุก 5 นาที
 *
 * ทำไมต้องมี: Cloudflare quick tunnel สุ่ม URL ใหม่ทุกครั้งที่รีสตาร์ต ของเดิมให้เครื่องบอทถือ
 * Vercel token ไว้แก้ env แล้ว redeploy เอง — token นั้นคุมบัญชี Vercel ได้ทั้งหมด
 * ไม่ควรวางไว้บนคอมที่บ้าน ทางนี้ใช้ TV_BOT_SECRET ที่บอทมีอยู่แล้ว และมีผลทันทีไม่ต้อง redeploy
 */

const schema = z.object({
  secret: z.string().max(256),
  // "ai" = gateway ของ QVX AI บนเครื่องบ้าน (src/lib/ai/gateway.ts) ใช้ตารางและ secret เดียวกับบอท
  role: z.enum(["primary", "backup", "ai"]),
  url: z.string().max(200),
});

/** hash ก่อนเทียบ ให้ยาวเท่ากันเสมอ — timingSafeEqual จะไม่ throw และไม่รั่วความยาว */
function secretMatches(given: string): boolean {
  const expected = process.env.TV_BOT_SECRET;
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!process.env.TV_BOT_SECRET) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const ip = await getClientIp();
  const rlKey = `bridge-register:${ip}`;
  if (await isRateLimited(rlKey, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  if (!secretMatches(parsed.data.secret)) {
    await recordAttempt(rlKey, 10 * 60_000);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = normalizeBridgeUrl(parsed.data.url);
  if (!url) return NextResponse.json({ error: "url_not_allowed" }, { status: 400 });

  const now = new Date();
  await prisma.bridgeEndpoint.upsert({
    where: { role: parsed.data.role },
    create: { role: parsed.data.role, url, lastSeenAt: now },
    update: { url, lastSeenAt: now },
  });
  return NextResponse.json({ ok: true, role: parsed.data.role, url });
}
