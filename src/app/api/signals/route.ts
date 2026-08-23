import { NextResponse } from "next/server";
import { z } from "zod";
import { sendToTopic, formatSignal, telegramEnabled } from "@/lib/telegram";

const schema = z.object({
  timeframe: z.enum(["M5", "M15", "M30", "1H"]),
  side: z.enum(["BUY", "SELL"]).optional(),
  symbol: z.string().max(20).optional(),
  entry: z.union([z.string(), z.number()]).optional(),
  tp: z.union([z.string(), z.number()]).optional(),
  sl: z.union([z.string(), z.number()]).optional(),
  note: z.string().max(500).optional(),
  text: z.string().max(2000).optional(),
  secret: z.string().optional(),
});

export async function POST(req: Request) {
  if (!telegramEnabled) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า Telegram" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid payload" }, { status: 400 });
  }

  // auth: header x-signal-secret หรือ field secret ใน body (สำหรับ TradingView alert ที่ตั้ง header ไม่ได้)
  const secret = req.headers.get("x-signal-secret") ?? parsed.data.secret;
  if (!process.env.TELEGRAM_SIGNAL_SECRET || secret !== process.env.TELEGRAM_SIGNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const text = formatSignal(parsed.data);
    await sendToTopic(parsed.data.timeframe, text);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "send failed" }, { status: 502 });
  }
}
