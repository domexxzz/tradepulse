import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signalPayloadSchema,
  isSecretValid,
  isPlanCoherent,
  MAX_SIGNAL_BODY_BYTES,
} from "@/lib/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** rate limit แบบง่ายในหน่วยความจำ — กันยิงถล่มจาก IP เดียว */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (hits.size > 1_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT_MAX;
}

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const expected = process.env.TRADINGVIEW_WEBHOOK_SECRET;
  // ไม่ตั้ง secret = ปิดรับไปเลย ดีกว่าเปิดรับแบบไม่ตรวจสอบ
  if (!expected) {
    return NextResponse.json({ error: "webhook disabled" }, { status: 503 });
  }

  if (isRateLimited(clientKey(req))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const body = await req.text();
  if (body.length > MAX_SIGNAL_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = signalPayloadSchema.safeParse(json);
  // ตอบ 401 เหมือนกันทั้งกรณี schema ผิดและ secret ผิด เพื่อไม่บอกใบ้ผู้โจมตี
  if (!parsed.success) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSecretValid(parsed.data.secret, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isPlanCoherent(parsed.data)) {
    return NextResponse.json({ error: "incoherent plan" }, { status: 422 });
  }

  const { symbol, side, price, tf, sl, tp1, tp2 } = parsed.data;
  try {
    const signal = await prisma.signal.create({
      data: { symbol: symbol.toUpperCase(), side, price, tf, sl, tp1, tp2 },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, id: signal.id, at: signal.createdAt });
  } catch {
    // ไม่ส่งรายละเอียด error ออกไป กันข้อมูลระบบรั่ว
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
}

/** กัน GET เผลอเปิดใน browser แล้วคิดว่าพัง */
export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
