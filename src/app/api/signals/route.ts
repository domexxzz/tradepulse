import { NextResponse } from "next/server";
import { z } from "zod";
import { sendToTopic, formatSignal, telegramEnabled, TIMEFRAMES, type Timeframe } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * แปลงไทม์เฟรมที่ TradingView ส่งมาให้เป็นรหัสของเรา
 *
 * `timeframe.period` ใน Pine คืนค่าเป็นนาทีล้วน ("5", "15", "30", "60")
 * ไม่ใช่ "M5"/"1H" ที่เราใช้ ถ้าไม่แปลงตรงนี้ alert จากอินดิเคเตอร์จะถูกปฏิเสธทุกครั้ง
 */
function normalizeTimeframe(raw: unknown): Timeframe | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (!v) return null;

  const map: Record<string, Timeframe> = {
    "5": "M5", M5: "M5", "5M": "M5",
    "15": "M15", M15: "M15", "15M": "M15",
    "30": "M30", M30: "M30", "30M": "M30",
    "60": "1H", "1H": "1H", H1: "1H", "60M": "1H",
  };
  return map[v] ?? (TIMEFRAMES.includes(v as Timeframe) ? (v as Timeframe) : null);
}

const num = z.union([z.string(), z.number()]).optional();

/**
 * รับได้ทั้งสองรูปแบบ:
 * - รูปแบบของเราเอง: {timeframe, entry, tp}
 * - รูปแบบที่อินดิเคเตอร์ SMC Unified ส่งมา: {tf, price, tp1, tp2}
 * ไม่งั้นต้องไปแก้ Pine ทุกเวอร์ชันแล้วสร้าง Alert ใหม่ทั้ง 12 ตัว
 */
const schema = z.object({
  timeframe: z.string().optional(),
  tf: z.string().optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  symbol: z.string().max(20).optional(),
  entry: num,
  price: num,
  tp: num,
  tp1: num,
  tp2: num,
  sl: num,
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
  const timeframe = normalizeTimeframe(d.timeframe ?? d.tf);
  if (!timeframe) {
    return NextResponse.json(
      { error: `ไทม์เฟรมไม่รองรับ: ${d.timeframe ?? d.tf ?? "(ไม่ได้ส่งมา)"} — รองรับ ${TIMEFRAMES.join(", ")}` },
      { status: 400 }
    );
  }

  const entry = str(d.entry ?? d.price);
  const tp = str(d.tp ?? d.tp1);
  const tp2 = str(d.tp2);

  // 1) เก็บลง DB สำหรับ Live Feed บนเว็บ (ไม่ให้ DB ล่มมากระทบการส่ง Telegram)
  try {
    await prisma.signal.create({
      data: {
        timeframe,
        side: d.side ?? null,
        symbol: d.symbol ?? "XAUUSD",
        entry,
        tp,
        tp2,
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
      await sendToTopic(
        timeframe,
        formatSignal({
          timeframe,
          side: d.side,
          symbol: d.symbol,
          entry: entry ?? undefined,
          tp: tp ?? undefined,
          tp2: tp2 ?? undefined,
          sl: str(d.sl) ?? undefined,
          note: d.note,
          text: d.text,
        })
      );
    } catch (e) {
      return NextResponse.json({ ok: true, telegram: false, error: e instanceof Error ? e.message : "telegram failed" });
    }
  }

  return NextResponse.json({ ok: true, timeframe });
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
