import { NextResponse } from "next/server";
import { z } from "zod";
import { sendToTopic, formatSignal, telegramEnabled } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

const str = (v: unknown) => (v === undefined || v === null ? null : String(v));

/** รับสัญญาณ: เก็บลง DB (โชว์บนเว็บ) + ส่งเข้า Telegram */
export async function POST(req: Request) {
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

  const secret = req.headers.get("x-signal-secret") ?? parsed.data.secret;
  if (!process.env.TELEGRAM_SIGNAL_SECRET || secret !== process.env.TELEGRAM_SIGNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const d = parsed.data;

  // 1) เก็บลง DB สำหรับ Live Feed บนเว็บ (ไม่ให้ DB ล่มมากระทบการส่ง Telegram)
  try {
    await prisma.signal.create({
      data: {
        timeframe: d.timeframe,
        side: d.side ?? null,
        symbol: d.symbol ?? "XAUUSD",
        entry: str(d.entry),
        tp: str(d.tp),
        sl: str(d.sl),
        note: d.note ?? null,
      },
    });
  } catch (e) {
    console.error("signal store failed:", e);
  }

  // 2) ส่งเข้า Telegram (ถ้าตั้งค่าไว้)
  if (telegramEnabled) {
    try {
      await sendToTopic(d.timeframe, formatSignal(d));
    } catch (e) {
      return NextResponse.json({ ok: true, telegram: false, error: e instanceof Error ? e.message : "telegram failed" });
    }
  }

  return NextResponse.json({ ok: true });
}

/** ดึงสัญญาณล่าสุดสำหรับแสดงบนเว็บ (อ่านอย่างเดียว) */
export async function GET() {
  try {
    const signals = await prisma.signal.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    return NextResponse.json({ signals });
  } catch {
    return NextResponse.json({ signals: [] });
  }
}

/** ล้างสัญญาณทั้งหมด (แอดมิน — auth ด้วย secret) */
export async function DELETE(req: Request) {
  const secret = req.headers.get("x-signal-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.TELEGRAM_SIGNAL_SECRET || secret !== process.env.TELEGRAM_SIGNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await prisma.signal.deleteMany({});
    return NextResponse.json({ ok: true, deleted: r.count });
  } catch {
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
