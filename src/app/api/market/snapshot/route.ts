import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { MARKET_MAX_BODY_BYTES, parseSnapshot, saveSnapshot } from "@/lib/ai/market";

export const dynamic = "force-dynamic";

/**
 * รับข้อมูลตลาดจากอินดิเคเตอร์ QVX AI บน TradingView (webhook ของ alert)
 *
 * TradingView ใส่ header เองไม่ได้ token จึงมากับ body ในช่อง "token"
 * ตั้งค่า MARKET_WEBHOOK_TOKEN บน Vercel ให้ตรงกับที่ใส่ในอินดิเคเตอร์ — ไม่ตั้ง = ปิดตาย
 */

/** เทียบแบบไม่รั่วเวลา — hash ก่อนให้ยาวเท่ากันเสมอ timingSafeEqual จะได้ไม่ throw */
function tokenMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = process.env.MARKET_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  if (Number(req.headers.get("content-length") ?? 0) > MARKET_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const raw = await req.text();
  if (!raw || Buffer.byteLength(raw) > MARKET_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "invalid_payload_size" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = typeof (body as { token?: unknown })?.token === "string" ? (body as { token: string }).token : "";
  if (!tokenMatches(token.slice(0, 256), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snapshot = parseSnapshot(body);
  if (!snapshot) return NextResponse.json({ error: "invalid_market_snapshot" }, { status: 400 });

  await saveSnapshot(snapshot);
  return NextResponse.json({ ok: true, symbol: snapshot.symbol });
}
