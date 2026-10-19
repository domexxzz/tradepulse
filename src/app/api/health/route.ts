import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** นานกว่านี้ถือว่าฐานข้อมูลใช้ไม่ได้ — ตอบช้าเท่านี้ลูกค้าก็เห็นหน้าเว็บค้างแล้ว */
const DB_TIMEOUT_MS = 8_000;

const NO_STORE = { "cache-control": "no-store" };

/**
 * ให้ตัวเฝ้าระบบภายนอก (.github/workflows/watchdog.yml) ถามว่าเว็บและฐานข้อมูลยังใช้ได้ไหม
 *
 * เช็คแค่หน้าแรกไม่พอ: 15-19 ต.ค. 69 ฐานข้อมูลล็อก หน้าแรก (static) ยังตอบ 200
 * แต่ทุกหน้าที่ใช้ข้อมูลพังหมด จึงต้องถามฐานข้อมูลจริงทุกครั้ง
 *
 * เปิดสาธารณะ ไม่ต้องใช้รหัส — ตอบแค่ใช้ได้/ไม่ได้ ไม่บอกสาเหตุ
 * (ข้อความ error ของ Prisma มีชื่อ host ฐานข้อมูลอยู่)
 */
export async function GET() {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`ฐานข้อมูลไม่ตอบใน ${DB_TIMEOUT_MS} ms`)), DB_TIMEOUT_MS);
    });
    await Promise.race([prisma.$queryRaw`select 1`, timeout]);
    return NextResponse.json({ ok: true, db: true, ms: Date.now() - started }, { headers: NO_STORE });
  } catch (e) {
    console.error("health: ฐานข้อมูลใช้ไม่ได้:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, db: false }, { status: 503, headers: NO_STORE });
  } finally {
    clearTimeout(timer);
  }
}
