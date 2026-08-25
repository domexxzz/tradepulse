import { NextResponse } from "next/server";
import { runMembershipMaintenance } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";
/** กวาดสมาชิกหลายร้อยรายพร้อมยิงอีเมล/Discord ต้องให้เวลาพอ */
export const maxDuration = 300;

/**
 * งานประจำวัน: ปิดสิทธิ์สมาชิกที่หมดอายุ + เตือนคนที่ใกล้หมด
 *
 * Vercel Cron จะแนบ header `Authorization: Bearer $CRON_SECRET` มาให้เองเมื่อตั้ง env CRON_SECRET
 * ตารางเวลาอยู่ใน vercel.json — ถ้าไม่ได้ตั้ง CRON_SECRET เส้นทางนี้จะถูกปิดตายไว้
 * (ปิดดีกว่าเปิดโล่ง เพราะใครก็ยิงให้ระบบไล่ปิดสิทธิ์สมาชิกได้)
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  return new URL(req.url).searchParams.get("secret") === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMembershipMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron/expire failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}

export const GET = run;
/** เผื่อเรียกด้วย POST จากตัวตั้งเวลาอื่น (cron-job.org, GitHub Actions ฯลฯ) */
export const POST = run;
