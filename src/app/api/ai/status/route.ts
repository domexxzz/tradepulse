import { NextResponse } from "next/server";
import { aiEngineStatus } from "@/lib/ai/gateway";
import { liveMarkets } from "@/lib/ai/market";

export const dynamic = "force-dynamic";

/**
 * สถานะ QVX AI แบบสาธารณะ — ไว้ให้ทีมงาน/ระบบเฝ้าระวังเช็กว่าพร้อมไหม
 * ตอบเฉพาะจริง/เท็จกับเวลา ไม่มี URL ของเครื่องบ้าน ไม่มี key ไม่มีข้อมูลลูกค้า
 */
export async function GET() {
  const [engine, live] = await Promise.all([aiEngineStatus(), liveMarkets()]);
  return NextResponse.json(
    {
      available: engine.available,
      local: engine.local,
      cloud: engine.cloud,
      market: live.map((m) => ({ symbol: m.symbol, chartTf: m.chartTf, receivedAt: m.receivedAt })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
